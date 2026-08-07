import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * PATIENT ISOLATION TEST SUITE
 * Two patients in the SAME hospital.
 * Patient A must NOT be able to see Patient B's EMR, prescriptions, lab orders, or invoices.
 * Patient A can access their OWN records.
 */
describe('PATIENT ISOLATION: Intra-Hospital Patient Privacy Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let patientAToken: string;
  let patientBToken: string;
  let patientAId: string;
  let patientBId: string;
  let hospitalId: string;

  // Records created for Patient B — Patient A should not see these
  let patientBApptId: string;
  let patientBEmrId: string;
  let patientBInvoiceId: string;
  let patientBLabOrderId: string;

  async function loginAs(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Password123!' });
    return res.body.data?.accessToken;
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

    patientAToken = await loginAs('patient1@example.com');
    patientBToken = await loginAs('patient2@example.com');

    const patientAUser = await prisma.user.findUnique({ where: { email: 'patient1@example.com' } });
    const patientBUser = await prisma.user.findUnique({ where: { email: 'patient2@example.com' } });

    const patientARecord = await prisma.patient.findUnique({ where: { userId: patientAUser!.id } });
    const patientBRecord = await prisma.patient.findUnique({ where: { userId: patientBUser!.id } });

    patientAId = patientARecord!.id;
    patientBId = patientBRecord!.id;
    hospitalId = patientARecord!.hospitalId;

    // Ensure both patients are in the same hospital
    expect(patientARecord!.hospitalId).toBe(patientBRecord!.hospitalId);

    const doctor = await prisma.doctor.findFirst({ include: { user: true } });

    // Create Patient B appointment
    const appt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patientBId,
        doctorId: doctor!.id,
        appointmentDate: '2026-12-25',
        slotTime: '11:00',
        status: 'CONFIRMED',
        type: 'REGULAR',
      },
    });
    patientBApptId = appt.id;

    // Create Patient B's EMR record
    const emr = await prisma.medicalRecord.create({
      data: {
        hospitalId,
        patientId: patientBId,
        doctorId: doctor!.id,
        appointmentId: patientBApptId,
        vitals: JSON.stringify({ bp: '120/80', pulse: 72 }),
        chiefComplaint: 'Patient B Private Condition',
        diagnosis: 'CONFIDENTIAL_DIAGNOSIS_B',
        treatmentPlan: 'Private Plan B',
      },
    });
    patientBEmrId = emr.id;

    // Create Patient B's invoice
    const invoice = await prisma.invoice.create({
      data: {
        hospitalId,
        patientId: patientBId,
        invoiceNumber: `PRIV-INV-${Date.now()}`,
        subtotal: 500,
        tax: 25,
        discount: 0,
        total: 525,
        status: 'FINAL',
        items: {
          create: [{ department: 'Consultation', description: 'Private B Invoice', quantity: 1, unitPrice: 500, totalAmount: 500 }],
        },
      },
    });
    patientBInvoiceId = invoice.id;

    // Create Patient B's lab order
    const labOrder = await prisma.labOrder.create({
      data: {
        hospitalId,
        patientId: patientBId,
        doctorId: doctor!.id,
        medicalRecordId: patientBEmrId,
        testName: 'Patient B Private Test',
        category: 'Private',
        status: 'ORDERED',
      },
    });
    patientBLabOrderId = labOrder.id;
  });

  afterAll(async () => {
    await prisma.labOrder.delete({ where: { id: patientBLabOrderId } }).catch(() => {});
    await prisma.invoiceItem.deleteMany({ where: { invoiceId: patientBInvoiceId } }).catch(() => {});
    await prisma.invoice.delete({ where: { id: patientBInvoiceId } }).catch(() => {});
    await prisma.medicalRecord.delete({ where: { id: patientBEmrId } }).catch(() => {});
    await prisma.appointment.delete({ where: { id: patientBApptId } }).catch(() => {});
    await app.close();
  });

  // ─── EMR Isolation ────────────────────────────────────────────────────────────

  test('Patient A cannot read Patient B\'s EMR by direct ID → 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/emr/${patientBEmrId}`)
      .set('Authorization', `Bearer ${patientAToken}`);

    // Must be 403 or 404 — never 200 with Patient B's record
    expect([403, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(JSON.stringify(res.body)).not.toContain('CONFIDENTIAL_DIAGNOSIS_B');
    }
  });

  test('Patient A EMR list does NOT contain Patient B records', async () => {
    const res = await request(app.getHttpServer())
      .get('/emr')
      .set('Authorization', `Bearer ${patientAToken}`);

    expect(res.status).toBe(200);
    const records = res.body.data;
    const hasBRecord = records.some((r: any) => r.patientId === patientBId);
    expect(hasBRecord).toBe(false);

    expect(JSON.stringify(records)).not.toContain('CONFIDENTIAL_DIAGNOSIS_B');
  });

  test('Patient A can access their own EMR records', async () => {
    const res = await request(app.getHttpServer())
      .get('/emr')
      .set('Authorization', `Bearer ${patientAToken}`);

    expect(res.status).toBe(200);
    for (const record of res.body.data) {
      expect(record.patientId).toBe(patientAId);
    }
  });

  // ─── Invoice Isolation ────────────────────────────────────────────────────────

  test('Patient A cannot access Patient B\'s invoice PDF by direct ID → 403 or 404', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invoices/${patientBInvoiceId}/pdf`)
      .set('Authorization', `Bearer ${patientAToken}`);

    expect([403, 404]).toContain(res.status);
  });

  test('Patient A invoice list does NOT include Patient B invoices', async () => {
    const res = await request(app.getHttpServer())
      .get('/invoices')
      .set('Authorization', `Bearer ${patientAToken}`);

    expect(res.status).toBe(200);
    const invoices = res.body.data;
    const hasBInvoice = invoices.some((inv: any) => inv.id === patientBInvoiceId);
    expect(hasBInvoice).toBe(false);
  });

  // ─── Lab Order Isolation ──────────────────────────────────────────────────────

  test('Patient A lab orders list does NOT contain Patient B lab orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/lab-orders')
      .set('Authorization', `Bearer ${patientAToken}`);

    expect(res.status).toBe(200);
    const orders = res.body.data;
    const hasBOrder = orders.some((o: any) => o.id === patientBLabOrderId);
    expect(hasBOrder).toBe(false);
  });

  // ─── Prescription Isolation ───────────────────────────────────────────────────

  test('Patient A prescription list does NOT contain Patient B prescriptions', async () => {
    const res = await request(app.getHttpServer())
      .get('/prescriptions')
      .set('Authorization', `Bearer ${patientAToken}`);

    expect(res.status).toBe(200);
    const prescriptions = res.body.data;
    for (const rx of prescriptions) {
      expect(rx.patientId).toBe(patientAId);
    }
  });

  // ─── Patient B can access their own records ───────────────────────────────────

  test('Patient B can access their own EMR by direct ID', async () => {
    const res = await request(app.getHttpServer())
      .get(`/emr/${patientBEmrId}`)
      .set('Authorization', `Bearer ${patientBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(patientBEmrId);
    expect(res.body.data.patientId).toBe(patientBId);
  });

  test('Invoice PDF endpoint requires authentication', async () => {
    const res = await request(app.getHttpServer())
      .get(`/invoices/${patientBInvoiceId}/pdf`);

    expect(res.status).toBe(401);
  });
});
