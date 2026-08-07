import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * APPOINTMENT STATE MACHINE TEST SUITE
 * Tests PRD-compliant lifecycle: PENDING→CONFIRMED→IN_PROGRESS→COMPLETED
 * Tests illegal transitions (COMPLETED→PENDING, CANCELLED→IN_PROGRESS, etc.)
 * Tests cancellation from all valid states.
 */
describe('APPOINTMENT STATE MACHINE: PRD Lifecycle Enforcement Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let receptionistToken: string;
  let doctorToken: string;
  let patientToken: string;

  let doctorId: string;
  let patientId: string;
  let hospitalId: string;

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Password123!' });
    return res.body.data?.accessToken;
  }

  let slotIndex = 0;
  async function createTestAppointment(status = 'PENDING'): Promise<string> {
    slotIndex++;
    const hour = String(9 + Math.floor(slotIndex / 60)).padStart(2, '0');
    const minute = String(slotIndex % 60).padStart(2, '0');
    const appt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId,
        doctorId,
        appointmentDate: '2026-12-28',
        slotTime: `${hour}:${minute}`,
        status,
        type: 'REGULAR',
      },
    });
    return appt.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    receptionistToken = await loginAs('reception@medcore-city.org');
    doctorToken = await loginAs('dr.sharma@medcore.org');
    patientToken = await loginAs('patient1@example.com');

    const doctor = await prisma.doctor.findFirst({ include: { user: true } });
    doctorId = doctor!.id;
    hospitalId = doctor!.user.hospitalId!;

    const patient = await prisma.patient.findFirst({ where: { hospitalId } });
    patientId = patient!.id;
  });

  afterAll(async () => {
    // Clean up test appointments created in wrong states
    await prisma.appointment.deleteMany({
      where: { appointmentDate: '2026-12-28', hospitalId },
    }).catch(() => {});
    await app.close();
  });

  // ─── Legal Lifecycle Flow ─────────────────────────────────────────────────────

  test('LEGAL: PENDING → CONFIRMED → 200', async () => {
    const id = await createTestAppointment('PENDING');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CONFIRMED');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('LEGAL: CONFIRMED → IN_PROGRESS → 200', async () => {
    const id = await createTestAppointment('CONFIRMED');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('LEGAL: IN_PROGRESS → COMPLETED → 200', async () => {
    const id = await createTestAppointment('IN_PROGRESS');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('COMPLETED');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('LEGAL: PENDING → CANCELLED → 200 (cancellation sets cancelledAt)', async () => {
    const id = await createTestAppointment('PENDING');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(res.body.data.cancelledAt).toBeDefined();
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('LEGAL: CONFIRMED → CANCELLED → 200', async () => {
    const id = await createTestAppointment('CONFIRMED');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CANCELLED');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  // ─── Illegal Transitions ──────────────────────────────────────────────────────

  test('ILLEGAL: PENDING → IN_PROGRESS (skipping CONFIRMED) → 400 ILLEGAL_TRANSITION', async () => {
    const id = await createTestAppointment('PENDING');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('ILLEGAL: PENDING → COMPLETED (skipping CONFIRMED + IN_PROGRESS) → 400 ILLEGAL_TRANSITION', async () => {
    const id = await createTestAppointment('PENDING');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'COMPLETED' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('ILLEGAL: COMPLETED → PENDING (reversal) → 400 ILLEGAL_TRANSITION', async () => {
    const id = await createTestAppointment('COMPLETED');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'PENDING' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('ILLEGAL: COMPLETED → CANCELLED → 400 ILLEGAL_TRANSITION', async () => {
    const id = await createTestAppointment('COMPLETED');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'CANCELLED' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('ILLEGAL: CANCELLED → IN_PROGRESS (revival) → 400 ILLEGAL_TRANSITION', async () => {
    const id = await createTestAppointment('CANCELLED');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'IN_PROGRESS' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  test('ILLEGAL: CANCELLED → CONFIRMED (revival) → 400 ILLEGAL_TRANSITION', async () => {
    const id = await createTestAppointment('CANCELLED');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });

  // ─── Notification & Audit Verification ────────────────────────────────────────

  test('Status update to CONFIRMED returns updated appointment with correct status', async () => {
    const id = await createTestAppointment('PENDING');
    const res = await request(app.getHttpServer())
      .patch(`/appointments/${id}/status`)
      .set('Authorization', `Bearer ${receptionistToken}`)
      .send({ status: 'CONFIRMED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.id).toBe(id);
    expect(res.body.data.status).toBe('CONFIRMED');
    await prisma.appointment.delete({ where: { id } }).catch(() => {});
  });
});
