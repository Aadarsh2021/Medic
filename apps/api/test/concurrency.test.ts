import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Mandatory Test Suite: NestJS PostgreSQL Appointment Concurrency & Conflict Protection', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let patientToken: string;
  let patient2Token: string;
  let doctorId: string;

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

    // Authenticate Patient 1
    const res1 = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'patient1@example.com',
      password: 'Password123!',
    });
    patientToken = res1.body.data.accessToken;

    // Authenticate Patient 2
    const res2 = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'patient2@example.com',
      password: 'Password123!',
    });
    patient2Token = res2.body.data.accessToken;

    const doctor = await prisma.doctor.findFirst();
    doctorId = doctor?.id || '';
  });

  afterAll(async () => {
    await app.close();
  });

  test('Competing simultaneous slot bookings for exact same doctor and time slot — exactly ONE succeeds', async () => {
    const targetDate = '2026-11-20';
    const targetSlot = '11:00';

    await prisma.appointment.deleteMany({
      where: { doctorId, appointmentDate: targetDate, slotTime: targetSlot },
    });

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId,
          appointmentDate: targetDate,
          slotTime: targetSlot,
          type: 'REGULAR',
          reason: 'NestJS Concurrent booking attempt A',
        }),
      request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${patient2Token}`)
        .send({
          doctorId,
          appointmentDate: targetDate,
          slotTime: targetSlot,
          type: 'REGULAR',
          reason: 'NestJS Concurrent booking attempt B',
        }),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([201, 409]);

    const conflictResponse = resA.status === 409 ? resA.body : resB.body;
    expect(conflictResponse.success).toBe(false);
    expect(conflictResponse.error.code).toBe('SLOT_UNAVAILABLE');
    expect([
      'This slot was just booked by another patient.',
      'This slot is already booked. Please choose another time.',
    ]).toContain(conflictResponse.error.message);

    await prisma.appointment.deleteMany({
      where: { doctorId, appointmentDate: targetDate, slotTime: targetSlot },
    });
  });
});
