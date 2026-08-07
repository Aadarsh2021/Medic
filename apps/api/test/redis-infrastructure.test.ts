import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * REDIS 7 INFRASTRUCTURE TEST SUITE
 * Verifies live Redis 7 session storage, refresh token rotation,
 * reuse detection, logout revocation, OTP TTL, and rate limiting against PostgreSQL 16 & Redis 7.
 */
describe('REDIS 7: Session, OTP, and Rate-Limiting Infrastructure Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  let testUserEmail = 'dr.sharma@medcore.org';
  let testUserToken: string;
  let testUserId: string;

  beforeAll(async () => {
    jest.setTimeout(30000);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    redis = app.get<RedisService>(RedisService);

    const user = await prisma.user.findUnique({ where: { email: testUserEmail } });
    testUserId = user!.id;
  });

  afterAll(async () => {
    // Clean up test keys
    const keys = await redis.keys('rt:*');
    if (keys && keys.length > 0) {
      await redis.del(...keys);
    }
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1 & 5: Refresh Session Storage & TTL
  // ─────────────────────────────────────────────────────────────────────────────

  test('1. Valid login creates a Redis-backed refresh session with 7-day TTL', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUserEmail, password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const setCookieHeader = res.headers['set-cookie'] as string[] | string;
    expect(setCookieHeader).toBeDefined();

    // Query Redis for stored session key rt:{userId}:*
    const sessionKeys = await redis.keys(`rt:${testUserId}:*`);
    expect(sessionKeys.length).toBeGreaterThan(0);

    const sessionKey = sessionKeys[0];
    const sessionData = await redis.get(sessionKey);
    expect(sessionData).toBeDefined();

    const parsedData = JSON.parse(sessionData!);
    expect(parsedData.userId).toBe(testUserId);
    expect(parsedData.tokenHash).toBeDefined();

    // Check TTL is ~604800 seconds (7 days)
    const ttl = await redis.getClient().ttl(sessionKey);
    expect(ttl).toBeGreaterThan(600000); // Greater than 6 days
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2 & 3: Refresh Token Rotation & Reuse Detection
  // ─────────────────────────────────────────────────────────────────────────────

  test('2. Refresh token rotation invalidates old refresh session and issues new token', async () => {
    // Perform initial login
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUserEmail, password: 'Password123!' });

    const setCookieHeader = loginRes.headers['set-cookie'] as string[] | string;
    const initialCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;

    // Execute refresh endpoint
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', initialCookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
    expect(refreshRes.body.data.refreshToken).toBeDefined();

    // Verify rotated cookie header is issued
    const newCookieHeader = refreshRes.headers['set-cookie'] as string[] | string;
    expect(newCookieHeader).toBeDefined();

    // 3. Reuse Detection: Attempting to use the OLD initial refresh token must be rejected!
    const reuseRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', initialCookie);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.success).toBe(false);
    expect(reuseRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4: Logout Revocation
  // ─────────────────────────────────────────────────────────────────────────────

  test('4. Logout revokes the active Redis refresh session', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testUserEmail, password: 'Password123!' });

    const token = loginRes.body.data.accessToken;
    const cookieHeader = loginRes.headers['set-cookie'] as string[] | string;
    const refreshCookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;

    // Logout
    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', refreshCookie);

    expect(logoutRes.status).toBe(200);

    // Attempting refresh with revoked cookie must fail → 401
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(refreshRes.status).toBe(401);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6 & 7: OTP Storage, TTL, and Invalidation
  // ─────────────────────────────────────────────────────────────────────────────

  test('6. OTP storage sets 10-minute TTL and invalidates immediately after successful use', async () => {
    const testEmail = 'otp.test@medcore.org';

    // Store OTP in Redis
    await app.get<any>(require('../src/modules/auth/auth.service').AuthService).requestOtp(testEmail, 'email');

    const redisKey = `otp:email:${testEmail}`;
    const storedOtpData = await redis.get(redisKey);
    expect(storedOtpData).toBeDefined();

    const ttl = await redis.getClient().ttl(redisKey);
    expect(ttl).toBeGreaterThan(500); // 10 min TTL (~600s)

    // Verify OTP with correct code '123456'
    const verifyRes = await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ email: testEmail, code: '123456' });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.success).toBe(true);

    // Key must be deleted immediately after verification
    const postVerifyOtpData = await redis.get(redisKey);
    expect(postVerifyOtpData).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8: Rate Limiting
  // ─────────────────────────────────────────────────────────────────────────────

  test('8. Rate limiting returns 429 Too Many Requests when limit is exceeded', async () => {
    const authService = app.get<any>(require('../src/modules/auth/auth.service').AuthService);
    const rateLimitKey = 'ratelimit_test_force:test_ip_192';
    await redis.del(rateLimitKey);

    // Send requests up to limit
    for (let i = 0; i < 5; i++) {
      await authService.checkRateLimit(rateLimitKey, 5, 60);
    }

    // 6th request exceeds limit and throws 429 HttpException
    let thrown = false;
    try {
      await authService.checkRateLimit(rateLimitKey, 5, 60);
    } catch (err: any) {
      thrown = true;
      expect(err.getStatus()).toBe(429);
      expect(err.getResponse().error.code).toBe('TOO_MANY_REQUESTS');
    }

    expect(thrown).toBe(true);
  });
});
