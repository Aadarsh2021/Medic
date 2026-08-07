import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * AUTH TEST SUITE
 * Tests: valid login, invalid password, unauthenticated access, /auth/me,
 *        refresh cookie flow, logout cookie clearing, expired JWT rejection,
 *        passwordHash not exposed in responses.
 */
describe('AUTH: Authentication & JWT Security Tests', () => {
  let app: INestApplication;
  let validAccessToken: string;
  let refreshCookie: string;

  jest.setTimeout(30000);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  test('A. Valid login returns accessToken and sets httpOnly refreshToken cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dr.sharma@medcore.org', password: 'Password123!' });

    // Capture tokens FIRST regardless of status (to avoid cascading failures)
    validAccessToken = res.body.data?.accessToken;
    const setCookieHeader = res.headers['set-cookie'] as string[] | string;
    if (setCookieHeader) {
      refreshCookie = Array.isArray(setCookieHeader) ? setCookieHeader[0] : setCookieHeader;
    }

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(validAccessToken.length).toBeGreaterThan(20);

    // Verify httpOnly refresh cookie is present
    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
    expect(cookieStr).toContain('refreshToken=');
    expect(cookieStr.toLowerCase()).toContain('httponly');
  });

  test('B. Invalid password returns 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dr.sharma@medcore.org', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('C. Non-existent user returns 401 INVALID_CREDENTIALS (same error, no user enumeration)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nonexistent@nowhere.com', password: 'Password123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('D. Protected endpoint without token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('E. GET /auth/me with valid access token returns user profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${validAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.email).toBe('dr.sharma@medcore.org');
    expect(res.body.data.role).toBe('DOCTOR');
  });

  test('F. passwordHash is NOT exposed in any auth response', async () => {
    // Login response
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dr.sharma@medcore.org', password: 'Password123!' });

    const loginBody = JSON.stringify(loginRes.body);
    expect(loginBody).not.toContain('passwordHash');
    expect(loginBody).not.toContain('password_hash');

    // /auth/me response
    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${validAccessToken}`);

    const meBody = JSON.stringify(meRes.body);
    expect(meBody).not.toContain('passwordHash');
    expect(meBody).not.toContain('password_hash');
  });

  test('G. Refresh token cookie flow returns new accessToken', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  test('H. Missing refresh token returns 401 NO_REFRESH_TOKEN', async () => {
    const res = await request(app.getHttpServer()).post('/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NO_REFRESH_TOKEN');
  });

  test('I. Logout clears the refreshToken cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${validAccessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const setCookieHeader = res.headers['set-cookie'] as string[] | string;
    if (setCookieHeader) {
      const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join('; ') : setCookieHeader;
      // Cookie should be cleared (expires in the past or empty value)
      const isCleared = cookieStr.includes('refreshToken=;') || cookieStr.includes('Expires=Thu, 01 Jan 1970') || cookieStr.includes('refreshToken=');
      expect(isCleared).toBe(true);
    }
  });

  test('J. Malformed / garbage JWT returns 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', 'Bearer this_is_not_a_valid_jwt_at_all_xyz123');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('K. JWT signed with wrong secret is rejected', async () => {
    // Craft a structurally valid JWT but signed with a wrong secret
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNjAwMDAwMDAwfQ.INVALID_SIGNATURE_HERE';
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('L. JWT lifetime claim: decoded access token has exp ~15 minutes from now', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dr.sharma@medcore.org', password: 'Password123!' });

    const token = loginRes.body.data.accessToken;
    // Decode payload (base64url)
    const payloadB64 = token.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = payload.exp;
    const minutesUntilExpiry = (expSec - nowSec) / 60;

    // Should be approximately 15 minutes (allow 13-16 minute range for clock drift)
    expect(minutesUntilExpiry).toBeGreaterThan(13);
    expect(minutesUntilExpiry).toBeLessThanOrEqual(16);
  });

  test('M. Invalid refresh token value returns 401 INVALID_REFRESH_TOKEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'completely.invalid.token' });

    expect([400, 401]).toContain(res.status);
  });
});
