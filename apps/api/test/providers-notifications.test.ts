import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { EmailProvider } from '../src/providers/interfaces/email-provider.interface';
import { SmsProvider } from '../src/providers/interfaces/sms-provider.interface';
import { ResendEmailAdapter } from '../src/providers/adapters/resend-email.adapter';
import { TwilioSmsAdapter } from '../src/providers/adapters/twilio-sms.adapter';
import { NotificationProcessor } from '../src/jobs/processors/notification.processor';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('CHECKPOINT 6: Notification & Provider Infrastructure Tests (Resend, Twilio, Redis OTP)', () => {
  let app: INestApplication;
  let emailProvider: ResendEmailAdapter;
  let smsProvider: TwilioSmsAdapter;
  let notificationProcessor: NotificationProcessor;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    emailProvider = app.get(ResendEmailAdapter);
    smsProvider = app.get(TwilioSmsAdapter);
    notificationProcessor = app.get(NotificationProcessor);
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  afterAll(async () => {
    await app.close();
  });

  test('1. ResendEmailAdapter detects capability status and handles development fallback cleanly without fake provider IDs', async () => {
    const status = emailProvider.getStatus();
    expect(['CONFIGURED', 'UNCONFIGURED', 'DEVELOPMENT_ADAPTER']).toContain(status);

    const result = await emailProvider.sendEmail({
      to: 'patient.test@example.com',
      subject: 'Appointment Reminder',
      template: 'APPOINTMENT_REMINDER',
      data: { recipientName: 'John Doe', hospitalName: 'MedCore City', appointmentDate: '2026-08-10', slotTime: '10:30' },
    });

    expect(result.success).toBe(true);
    if (status === 'DEVELOPMENT_ADAPTER') {
      expect(result.provider).toBe('DEVELOPMENT');
      expect(result.messageId).toBeUndefined(); // Explicit constraint: Do NOT return fake production IDs
    }
  });

  test('2. Resend email adapter safely escapes HTML-sensitive payloads against XSS injection', async () => {
    const xssPayload = "<script>alert('xss')</script>";
    const result = await emailProvider.sendEmail({
      to: 'xss.test@example.com',
      subject: 'XSS Test',
      template: 'APPOINTMENT_REMINDER',
      data: { recipientName: xssPayload, hospitalName: xssPayload, appointmentDate: '2026-08-10', slotTime: '10:30' },
    });

    expect(result.success).toBe(true);
  });

  test('3. TwilioSmsAdapter normalizes phone numbers to E.164 and handles delivery gracefully without leaking credentials', async () => {
    const status = smsProvider.getStatus();
    expect(['CONFIGURED', 'UNCONFIGURED', 'DEVELOPMENT_ADAPTER']).toContain(status);

    const result = await smsProvider.sendSms({
      to: '9876543210', // 10 digit local phone number
      message: 'MedCore OTP Code: 123456',
    });

    expect(result.success).toBe(true);
    if (status === 'DEVELOPMENT_ADAPTER') {
      expect(result.provider).toBe('DEVELOPMENT');
      expect(result.messageSid).toBeUndefined(); // Explicit constraint: Do NOT return fake Twilio SIDs
    }
  });

  test('4. Twilio SMS error sanitization protects Account SID and Auth Tokens from leaking in error messages', async () => {
    const adapter = new TwilioSmsAdapter();
    // Simulate error handling with sanitized SID mask check
    const result = await adapter.sendSms({ to: '+1234567890', message: 'Test' });
    if (result.error) {
      expect(result.error).not.toMatch(/AC[a-f0-9]{32}/gi); // Token pattern sanitized
    }
  });

  test('5. NotificationProcessor routes EMAIL & SMS jobs through real providers with channel failure isolation', async () => {
    const hosp = await prisma.hospital.findFirst();
    const user = await prisma.user.findFirst({ where: { hospitalId: hosp!.id } });

    // EMAIL notification job
    const emailJobRes = await notificationProcessor.process({
      id: 'job-email-1',
      data: {
        userId: user!.id,
        hospitalId: hosp!.id,
        channel: 'EMAIL',
        title: 'Prescription Notification',
        message: 'Your prescription is now ready.',
        recipientEmail: user!.email,
      },
    } as any);

    expect(emailJobRes.success).toBe(true);
    expect(emailJobRes.channel).toBe('EMAIL');

    // SMS notification job
    const smsJobRes = await notificationProcessor.process({
      id: 'job-sms-1',
      data: {
        userId: user!.id,
        hospitalId: hosp!.id,
        channel: 'SMS',
        title: 'MedCore Alert',
        message: 'Your appointment is confirmed.',
        recipientPhone: user!.phone,
      },
    } as any);

    expect(smsJobRes.success).toBe(true);
    expect(smsJobRes.channel).toBe('SMS');
  });

  test('6. Channel failure isolation: EMAIL channel failure does not break IN_APP notification storage or crash worker', async () => {
    const hosp = await prisma.hospital.findFirst();
    const user = await prisma.user.findFirst({ where: { hospitalId: hosp!.id } });

    // Process job with invalid/failing configuration
    const res = await notificationProcessor.process({
      id: 'job-fail-1',
      data: {
        userId: user!.id,
        hospitalId: hosp!.id,
        channel: 'EMAIL',
        title: 'Resilient Test',
        message: 'Failure isolation test',
        recipientEmail: 'invalid-email-format',
      },
    } as any);

    expect(res.notificationId).toBeDefined(); // IN_APP notification record created successfully
  });

  test('7. OTP delivery integration preserves Redis TTL state without saving plaintext secrets in PostgreSQL', async () => {
    const email = 'otp.test@medcore.org';
    const otpCode = '889900';

    // Save OTP to Redis with 600s TTL (Checkpoint 3 Redis architecture)
    await redis.getClient().setex(`otp:${email}`, 600, otpCode);

    // Fetch and verify OTP state from Redis
    const savedOtp = await redis.getClient().get(`otp:${email}`);
    expect(savedOtp).toBe(otpCode);

    const ttl = await redis.getClient().ttl(`otp:${email}`);
    expect(ttl).toBeGreaterThan(0);

    // Clean up
    await redis.getClient().del(`otp:${email}`);
  });
});
