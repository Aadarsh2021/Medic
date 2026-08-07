import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Mandatory Test Suite: NestJS Pharmacy Expiry & Dispensing Rules', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let pharmToken: string;

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
      email: 'pharmacist@medcore-city.org',
      password: 'Password123!',
    });
    pharmToken = res.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  test('An expired medicine cannot be dispensed — pharmacy throws EXPIRED_MEDICINE error', async () => {
    const amoxicillin = await prisma.medicine.findFirst({ where: { name: 'Amoxicillin 500mg' } });

    if (amoxicillin) {
      const res = await request(app.getHttpServer())
        .post('/medicines/dispense')
        .set('Authorization', `Bearer ${pharmToken}`)
        .send({
          medicineId: amoxicillin.id,
          quantityToDispense: 160,
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('EXPIRED_MEDICINE');
    }
  });
});
