import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Mandatory Test Suite: NestJS Billing Integrity & Calculations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let acctToken: string;
  let validPatientId: string;

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

    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'accountant@medcore-city.org',
      password: 'Password123!',
    });
    acctToken = res.body.data.accessToken;

    const patient = await prisma.patient.findFirst();
    validPatientId = patient?.id || 'demo-patient-id';
  });

  afterAll(async () => {
    await app.close();
  });

  test('An invoice total matches the sum of all line items plus tax minus discount', async () => {
    const res = await request(app.getHttpServer())
      .post('/invoices')
      .set('Authorization', `Bearer ${acctToken}`)
      .send({
        patientId: validPatientId,
        items: [
          { department: 'Consultation', description: 'Specialist Fee', quantity: 1, unitPrice: 100 },
          { department: 'Pharmacy', description: 'Antibiotics', quantity: 2, unitPrice: 25 },
        ],
        discount: 10,
      });

    expect(res.status).toBe(201);
    const inv = res.body.data;
    const expectedSubtotal = 100 + 50; // 150
    const expectedTax = 150 * 0.05; // 7.5
    const expectedTotal = 150 + 7.5 - 10; // 147.5

    expect(inv.subtotal).toBe(expectedSubtotal);
    expect(inv.tax).toBe(expectedTax);
    expect(inv.total).toBe(expectedTotal);
  });
});
