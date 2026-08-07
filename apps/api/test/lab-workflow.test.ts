import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * LAB WORKFLOW TEST SUITE
 * Tests the complete legal state machine:
 * ORDERED → SAMPLE_COLLECTED → RESULT_UPLOADED → APPROVED
 *
 * Also tests illegal transitions, role restrictions, and reference range calculation.
 */
describe('LAB WORKFLOW: State Machine, Role Restrictions, and Reference Range Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let doctorToken: string;
  let labTechToken: string;
  let patientToken: string;

  let doctorId: string;
  let patientId: string;
  let hospitalId: string;
  let sharedMedicalRecordId: string;
  let sharedAppointmentId: string;

  // Lab orders for separate test scenarios
  let labOrderIdForFullFlow: string;
  let labOrderIdForIllegalTransitions: string;
  let labOrderIdForRoleTest: string;

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Password123!' });
    return res.body.data?.accessToken;
  }

  async function createLabOrder(patId: string): Promise<string> {
    const order = await prisma.labOrder.create({
      data: {
        hospitalId,
        patientId: patId,
        doctorId,
        medicalRecordId: sharedMedicalRecordId,
        testName: 'Complete Blood Count',
        category: 'Hematology',
        status: 'ORDERED',
      },
    });
    return order.id;
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

    doctorToken = await loginAs('dr.sharma@medcore.org');
    labTechToken = await loginAs('labtech@medcore-city.org');
    patientToken = await loginAs('patient1@example.com');

    const doctor = await prisma.doctor.findFirst({ include: { user: true } });
    doctorId = doctor!.id;
    hospitalId = doctor!.user.hospitalId!;

    const patient = await prisma.patient.findFirst({ where: { hospitalId } });
    patientId = patient!.id;

    // Create shared appointment and medical record for test lab orders
    const appt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId,
        doctorId,
        appointmentDate: '2026-12-26',
        slotTime: '09:30',
        status: 'COMPLETED',
        type: 'REGULAR',
      },
    });
    sharedAppointmentId = appt.id;

    const emr = await prisma.medicalRecord.create({
      data: {
        hospitalId,
        patientId,
        doctorId,
        appointmentId: sharedAppointmentId,
        vitals: JSON.stringify({ bp: '120/80' }),
        chiefComplaint: 'Fever check',
        diagnosis: 'Routine Checkup',
        treatmentPlan: 'Blood panel',
      },
    });
    sharedMedicalRecordId = emr.id;

    // Create fresh orders for each scenario
    labOrderIdForFullFlow = await createLabOrder(patientId);
    labOrderIdForIllegalTransitions = await createLabOrder(patientId);
    labOrderIdForRoleTest = await createLabOrder(patientId);
  });

  afterAll(async () => {
    await prisma.labResult.deleteMany({ where: { labOrderId: { in: [labOrderIdForFullFlow, labOrderIdForIllegalTransitions, labOrderIdForRoleTest] } } }).catch(() => {});
    await prisma.labOrder.deleteMany({ where: { id: { in: [labOrderIdForFullFlow, labOrderIdForIllegalTransitions, labOrderIdForRoleTest] } } }).catch(() => {});
    if (sharedMedicalRecordId) await prisma.medicalRecord.delete({ where: { id: sharedMedicalRecordId } }).catch(() => {});
    if (sharedAppointmentId) await prisma.appointment.delete({ where: { id: sharedAppointmentId } }).catch(() => {});
    await app.close();
  });

  // ─── Full Legal State Machine Flow ────────────────────────────────────────────

  test('STEP 1: Lab order starts in ORDERED state', async () => {
    const order = await prisma.labOrder.findUnique({ where: { id: labOrderIdForFullFlow } });
    expect(order!.status).toBe('ORDERED');
  });

  test('STEP 2: ORDERED → SAMPLE_COLLECTED (collect sample) → 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${labOrderIdForFullFlow}/collect`)
      .set('Authorization', `Bearer ${labTechToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SAMPLE_COLLECTED');
  });

  test('STEP 3: SAMPLE_COLLECTED → RESULT_UPLOADED (upload result with reference range) → 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${labOrderIdForFullFlow}/result`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({
        resultValue: 14.5,
        refRangeMin: 12.0,
        refRangeMax: 17.0,
        unit: 'g/dL',
        technicianNotes: 'Normal hemoglobin',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RESULT_UPLOADED');

    const results = res.body.data.results;
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);

    const result = results[0];
    expect(result.resultValue).toBe(14.5);
    expect(result.refRangeMin).toBe(12.0);
    expect(result.refRangeMax).toBe(17.0);
    expect(result.isOutOfRange).toBe(false);
  });

  test('STEP 4: RESULT_UPLOADED → APPROVED (approve result) → 200', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${labOrderIdForFullFlow}/approve`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
  });

  // ─── Illegal Transition Tests ─────────────────────────────────────────────────

  test('ILLEGAL: ORDERED → APPROVED directly must be rejected → 400', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${labOrderIdForIllegalTransitions}/approve`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'APPROVED' });

    expect([400, 422]).toContain(res.status);
  });

  test('ILLEGAL: Cannot upload result before sample collection → 400 or INVALID_STATE', async () => {
    const freshOrder = await prisma.labOrder.create({
      data: {
        hospitalId,
        patientId,
        doctorId,
        medicalRecordId: sharedMedicalRecordId,
        testName: 'Illegal Transition Test',
        category: 'Test',
        status: 'ORDERED',
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${freshOrder.id}/result`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({ resultValue: 10, refRangeMin: 5, refRangeMax: 15, unit: 'mg/dL' });

    expect([400, 422]).toContain(res.status);

    await prisma.labOrder.delete({ where: { id: freshOrder.id } }).catch(() => {});
  });

  // ─── Reference Range & isOutOfRange Calculation ───────────────────────────────

  test('Result BELOW reference range sets isOutOfRange = true', async () => {
    const freshOrder = await prisma.labOrder.create({
      data: {
        hospitalId,
        patientId,
        doctorId,
        medicalRecordId: sharedMedicalRecordId,
        testName: 'Out of Range Low Test',
        category: 'Chemistry',
        status: 'SAMPLE_COLLECTED',
        sampleCollectedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${freshOrder.id}/result`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({
        resultValue: 3.0,
        refRangeMin: 5.0,
        refRangeMax: 10.0,
        unit: 'mmol/L',
      });

    expect(res.status).toBe(200);
    const result = res.body.data.results[0];
    expect(result.isOutOfRange).toBe(true);

    await prisma.labResult.deleteMany({ where: { labOrderId: freshOrder.id } }).catch(() => {});
    await prisma.labOrder.delete({ where: { id: freshOrder.id } }).catch(() => {});
  });

  test('Result ABOVE reference range sets isOutOfRange = true', async () => {
    const freshOrder = await prisma.labOrder.create({
      data: {
        hospitalId,
        patientId,
        doctorId,
        medicalRecordId: sharedMedicalRecordId,
        testName: 'Out of Range High Test',
        category: 'Chemistry',
        status: 'SAMPLE_COLLECTED',
        sampleCollectedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${freshOrder.id}/result`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({
        resultValue: 15.0,
        refRangeMin: 5.0,
        refRangeMax: 10.0,
        unit: 'mmol/L',
      });

    expect(res.status).toBe(200);
    const result = res.body.data.results[0];
    expect(result.isOutOfRange).toBe(true);

    await prisma.labResult.deleteMany({ where: { labOrderId: freshOrder.id } }).catch(() => {});
    await prisma.labOrder.delete({ where: { id: freshOrder.id } }).catch(() => {});
  });

  test('Result WITHIN reference range sets isOutOfRange = false', async () => {
    const freshOrder = await prisma.labOrder.create({
      data: {
        hospitalId,
        patientId,
        doctorId,
        medicalRecordId: sharedMedicalRecordId,
        testName: 'Normal Range Test',
        category: 'Chemistry',
        status: 'SAMPLE_COLLECTED',
        sampleCollectedAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${freshOrder.id}/result`)
      .set('Authorization', `Bearer ${labTechToken}`)
      .send({
        resultValue: 7.5,
        refRangeMin: 5.0,
        refRangeMax: 10.0,
        unit: 'mmol/L',
      });

    expect(res.status).toBe(200);
    const result = res.body.data.results[0];
    expect(result.isOutOfRange).toBe(false);

    await prisma.labResult.deleteMany({ where: { labOrderId: freshOrder.id } }).catch(() => {});
    await prisma.labOrder.delete({ where: { id: freshOrder.id } }).catch(() => {});
  });

  // ─── Role Restrictions ────────────────────────────────────────────────────────

  test('PATIENT cannot create lab order → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/lab-orders')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ patientId, testName: 'Self-Ordered Test', category: 'Unauthorized' });

    expect(res.status).toBe(403);
  });

  test('PATIENT cannot collect sample → 403', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/lab-orders/${labOrderIdForRoleTest}/collect`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(403);
  });
});
