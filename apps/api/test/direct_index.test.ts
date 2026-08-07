import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('NestJS Step 9 & 10: PostgreSQL Partial Unique Index Invariants & Prisma P2002 Direct DB Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let doctorId: string;
  let patient1Id: string;
  let patient2Id: string;
  let hospitalId: string;

  const testDate = '2026-12-25';
  const testSlot = '14:30';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    const doc = await prisma.doctor.findFirst({ include: { user: true } });
    doctorId = doc!.id;
    hospitalId = doc!.user.hospitalId || '';

    const patients = await prisma.patient.findMany({ take: 2 });
    patient1Id = patients[0].id;
    patient2Id = patients[1].id;

    await prisma.appointment.deleteMany({
      where: { doctorId, appointmentDate: testDate, slotTime: testSlot },
    });
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({
      where: { doctorId, appointmentDate: testDate, slotTime: testSlot },
    });
    await app.close();
  });

  test('CASE A: Two active NORMAL appointments for same doctor/date/slot — PostgreSQL rejects second insert with P2002', async () => {
    const appt1 = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: testDate,
        slotTime: testSlot,
        status: 'PENDING',
        type: 'REGULAR',
        reason: 'Direct DB Test 1',
      },
    });
    expect(appt1.id).toBeDefined();

    let errorCaught: any = null;
    try {
      await prisma.appointment.create({
        data: {
          hospitalId,
          patientId: patient2Id,
          doctorId,
          appointmentDate: testDate,
          slotTime: testSlot,
          status: 'PENDING',
          type: 'REGULAR',
          reason: 'Direct DB Test 2 Duplicate',
        },
      });
    } catch (err: any) {
      errorCaught = err;
    }

    expect(errorCaught).toBeDefined();
    expect(errorCaught.code).toBe('P2002');

    await prisma.appointment.delete({ where: { id: appt1.id } });
  });

  test('CASE B: Existing CANCELLED appointment then new active NORMAL appointment — Allowed', async () => {
    const cancelledAppt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: testDate,
        slotTime: testSlot,
        status: 'CANCELLED',
        type: 'REGULAR',
        reason: 'Cancelled appointment',
      },
    });

    const activeAppt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patient2Id,
        doctorId,
        appointmentDate: testDate,
        slotTime: testSlot,
        status: 'PENDING',
        type: 'REGULAR',
        reason: 'Active replacement for cancelled slot',
      },
    });

    expect(activeAppt.id).toBeDefined();

    await prisma.appointment.deleteMany({
      where: { id: { in: [cancelledAppt.id, activeAppt.id] } },
    });
  });

  test('CASE C: Soft-deleted appointment then new active NORMAL appointment — Allowed', async () => {
    const deletedAppt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: testDate,
        slotTime: testSlot,
        status: 'CONFIRMED',
        type: 'REGULAR',
        deletedAt: new Date(),
        reason: 'Soft deleted appointment',
      },
    });

    const activeAppt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patient2Id,
        doctorId,
        appointmentDate: testDate,
        slotTime: testSlot,
        status: 'PENDING',
        type: 'REGULAR',
        reason: 'Active slot overriding soft-deleted',
      },
    });

    expect(activeAppt.id).toBeDefined();

    await prisma.appointment.deleteMany({
      where: { id: { in: [deletedAppt.id, activeAppt.id] } },
    });
  });

  test('CASE D: EMERGENCY appointment behavior — Allowed alongside normal appointment', async () => {
    const emergencyAppt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patient1Id,
        doctorId,
        appointmentDate: testDate,
        slotTime: testSlot,
        status: 'CONFIRMED',
        type: 'EMERGENCY',
        reason: 'Emergency walk-in',
      },
    });

    const regularAppt = await prisma.appointment.create({
      data: {
        hospitalId,
        patientId: patient2Id,
        doctorId,
        appointmentDate: testDate,
        slotTime: testSlot,
        status: 'PENDING',
        type: 'REGULAR',
        reason: 'Regular scheduled booking',
      },
    });

    expect(emergencyAppt.id).toBeDefined();
    expect(regularAppt.id).toBeDefined();

    await prisma.appointment.deleteMany({
      where: { id: { in: [emergencyAppt.id, regularAppt.id] } },
    });
  });
});
