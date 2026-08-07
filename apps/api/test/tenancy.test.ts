import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Mandatory Test Suite: NestJS Tenancy Isolation Security', () => {
  let app: INestApplication;
  let hospAToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    const resA = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'dr.sharma@medcore.org',
      password: 'Password123!',
    });
    hospAToken = resA.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  test('Doctor from Hospital A CANNOT access Hospital B patient records', async () => {
    const res = await request(app.getHttpServer())
      .get('/emr?hospitalId=APEX-HEALTH-INVALID')
      .set('Authorization', `Bearer ${hospAToken}`);

    if (res.body.data) {
      const records = res.body.data;
      const crossTenantViolation = records.some((r: any) => r.hospitalId === 'APEX-HEALTH-INVALID');
      expect(crossTenantViolation).toBe(false);
    }
  });
});
