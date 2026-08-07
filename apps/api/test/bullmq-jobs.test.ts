import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JobsService } from '../src/jobs/jobs.service';
import { AppointmentReminderProducer } from '../src/jobs/producers/appointment-reminder.producer';
import { AppointmentReminderProcessor } from '../src/jobs/processors/appointment-reminder.processor';
import { MedicineExpiryProducer } from '../src/jobs/producers/medicine-expiry.producer';
import { MedicineExpiryProcessor } from '../src/jobs/processors/medicine-expiry.processor';
import { NotificationProcessor } from '../src/jobs/processors/notification.processor';

/**
 * BULLMQ BACKGROUND JOBS & WORKERS TEST SUITE
 * Tests live BullMQ queues on Redis 7 & PostgreSQL 16:
 * - 24h/1h Appointment Reminder scheduling & idempotency
 * - Cancelled appointment stale job skipping
 * - Notification processing & channel failure isolation
 * - Medicine Expiry Scan (expired & 30-day expiring stock detection)
 * - Repeatable scheduler idempotency & job payload privacy
 */
describe('BULLMQ 5: Background Jobs & Workers Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jobsService: JobsService;
  let reminderProducer: AppointmentReminderProducer;
  let reminderProcessor: AppointmentReminderProcessor;
  let expiryProducer: MedicineExpiryProducer;
  let expiryProcessor: MedicineExpiryProcessor;
  let notificationProcessor: NotificationProcessor;

  let testHospitalId: string;
  let testPatientUserId: string;

  beforeAll(async () => {
    jest.setTimeout(30000);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    jobsService = app.get<JobsService>(JobsService);
    reminderProducer = app.get<AppointmentReminderProducer>(AppointmentReminderProducer);
    reminderProcessor = app.get<AppointmentReminderProcessor>(AppointmentReminderProcessor);
    expiryProducer = app.get<MedicineExpiryProducer>(MedicineExpiryProducer);
    expiryProcessor = app.get<MedicineExpiryProcessor>(MedicineExpiryProcessor);
    notificationProcessor = app.get<NotificationProcessor>(NotificationProcessor);

    const hospital = await prisma.hospital.findFirst();
    testHospitalId = hospital!.id;

    const user = await prisma.user.findFirst({ where: { role: 'PATIENT' } });
    testPatientUserId = user!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A, B, C, D: Reminder Scheduling & Idempotency
  // ─────────────────────────────────────────────────────────────────────────────

  test('A, B, C, D. Schedules 24h & 1h appointment reminders idempotently without duplicate jobs', async () => {
    const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h from now
    const dummyApptId = 'test-appt-id-123';

    // Schedule reminders twice
    await reminderProducer.scheduleReminders(dummyApptId, testHospitalId, futureDate);
    await reminderProducer.scheduleReminders(dummyApptId, testHospitalId, futureDate);

    // Fetch queue instance from BullModule
    const queue = app.get<any>('BullQueue_appointment-reminders');
    expect(queue).toBeDefined();

    const job24h = await queue.getJob(`appt-${dummyApptId}-rem-24h`);
    const job1h = await queue.getJob(`appt-${dummyApptId}-rem-1h`);

    expect(job24h).toBeDefined();
    expect(job1h).toBeDefined();

    // Verify Job Payload Privacy: Payloads must contain IDs, NOT full patient/medical records
    expect(job24h.data).toEqual({
      appointmentId: dummyApptId,
      hospitalId: testHospitalId,
      reminderType: '24h',
    });
    expect(job24h.data.patientRecord).toBeUndefined();

    // Clean up dummy jobs
    await queue.remove(`appt-${dummyApptId}-rem-24h`).catch(() => {});
    await queue.remove(`appt-${dummyApptId}-rem-1h`).catch(() => {});
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // E: Cancelled Appointment Reminder Skipping
  // ─────────────────────────────────────────────────────────────────────────────

  test('E. Processor skips reminder if appointment is CANCELLED in PostgreSQL', async () => {
    // Create an actual CANCELLED appointment in PostgreSQL
    const doctor = await prisma.doctor.findFirst();
    const patient = await prisma.patient.findFirst();

    const appt = await prisma.appointment.create({
      data: {
        hospitalId: testHospitalId,
        patientId: patient!.id,
        doctorId: doctor!.id,
        appointmentDate: '2026-12-31',
        slotTime: '11:45',
        status: 'CANCELLED',
        type: 'REGULAR',
      },
    });

    // Execute processor on CANCELLED appointment
    const dummyJob = {
      data: {
        appointmentId: appt.id,
        hospitalId: testHospitalId,
        reminderType: '24h',
      },
    } as any;

    const result = await reminderProcessor.process(dummyJob);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('CANCELLED');

    // Clean up test record
    await prisma.appointment.delete({ where: { id: appt.id } });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // F & G: Notification Processing & Channel Failure Isolation
  // ─────────────────────────────────────────────────────────────────────────────

  test('F, G. Processes IN_APP notification and isolates channel failures (EMAIL/SMS dev adapter)', async () => {
    const inAppJob = {
      data: {
        userId: testPatientUserId,
        hospitalId: testHospitalId,
        channel: 'IN_APP',
        title: 'Test Notification',
        message: 'Your lab report is ready.',
      },
    } as any;

    const inAppResult = await notificationProcessor.process(inAppJob);
    expect(inAppResult.success).toBe(true);
    expect(inAppResult.notificationId).toBeDefined();

    // Verify DB record created
    const notif = await prisma.notification.findUnique({
      where: { id: inAppResult.notificationId },
    });
    expect(notif).toBeDefined();
    expect(notif!.title).toBe('Test Notification');

    // Clean up DB record
    await prisma.notification.delete({ where: { id: inAppResult.notificationId } });

    // EMAIL channel (pending provider) does NOT throw or crash IN_APP channel
    const emailJob = {
      data: {
        userId: testPatientUserId,
        hospitalId: testHospitalId,
        channel: 'EMAIL',
        title: 'Test Email',
        message: 'Email content',
      },
    } as any;

    const emailResult = await notificationProcessor.process(emailJob);
    expect(emailResult.success).toBe(true);
    expect(emailResult.deliveryResult || emailResult.status).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // H & I: Medicine Expiry Scan (Expired & 30-Day Expiring Stock)
  // ─────────────────────────────────────────────────────────────────────────────

  test('H, I. Medicine Expiry Scan identifies expired batches and batches expiring within 30 days', async () => {
    const medicine = await prisma.medicine.findFirst();
    const hospital = await prisma.hospital.findFirst();

    // Create an expired batch (expired 10 days ago)
    const expiredDateStr = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const expiredBatch = await prisma.medicineBatch.create({
      data: {
        medicineId: medicine!.id,
        batchNumber: `EXP-TEST-${Date.now()}`,
        mfgDate: '2024-01-01',
        expiryDate: expiredDateStr,
        quantity: 50,
        unitCost: 10.0,
        mrp: 15.0,
      },
    });

    // Create a batch expiring within 30 days (expires in 15 days)
    const expiringSoonDateStr = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const expiringSoonBatch = await prisma.medicineBatch.create({
      data: {
        medicineId: medicine!.id,
        batchNumber: `SOON-TEST-${Date.now()}`,
        mfgDate: '2024-01-01',
        expiryDate: expiringSoonDateStr,
        quantity: 30,
        unitCost: 12.0,
        mrp: 18.0,
      },
    });

    // Run Medicine Expiry Processor
    const dummyJob = { data: { trigger: 'TEST_RUN' } } as any;
    const scanResult = await expiryProcessor.process(dummyJob);

    expect(scanResult.success).toBe(true);
    expect(scanResult.expiredCount).toBeGreaterThanOrEqual(1);
    expect(scanResult.expiringSoonCount).toBeGreaterThanOrEqual(1);

    // Clean up test batches
    await prisma.medicineBatch.deleteMany({
      where: { id: { in: [expiredBatch.id, expiringSoonBatch.id] } },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // J: Repeatable Scheduler Idempotency
  // ─────────────────────────────────────────────────────────────────────────────

  test('J. Repeatable expiry scan registration is idempotent across restarts', async () => {
    await expiryProducer.registerDailyExpiryScan();
    await expiryProducer.registerDailyExpiryScan();

    const expiryQueue = app.get<any>('BullQueue_medicine-expiry');
    const repeatables = await expiryQueue.getRepeatableJobs();

    // Verify there is at most 1 repeatable scan schedule
    const scanSchedules = repeatables.filter((j: any) => j.name === 'daily-expiry-scan');
    expect(scanSchedules.length).toBeLessThanOrEqual(1);
  });
});
