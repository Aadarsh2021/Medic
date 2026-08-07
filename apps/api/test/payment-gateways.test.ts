import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('CHECKPOINT 6: Payment Gateway Infrastructure Tests (Stripe, Razorpay, Webhooks, Security)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superAdminToken: string;
  let hospitalAdminAToken: string;
  let hospitalAdminBToken: string;
  let patientAToken: string;
  let testInvoiceAId: string;
  let testInvoiceBId: string;
  let hospitalAId: string;
  let hospitalBId: string;
  let patientAUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    const loginUser = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Password123!' });
      return res.body?.data?.accessToken;
    };

    superAdminToken = await loginUser('superadmin@medcore.org');
    hospitalAdminAToken = await loginUser('admin@medcore-city.org');
    hospitalAdminBToken = await loginUser('admin.b@hospital-b.org');
    patientAToken = await loginUser('patient1@example.com');

    const hA = await prisma.hospital.findFirst({ where: { code: 'MED-CITY' } });
    const hB = await prisma.hospital.findFirst({ where: { code: 'APEX-HEALTH' } });
    hospitalAId = hA!.id;
    hospitalBId = hB ? hB.id : hA!.id;

    const pAUser = await prisma.user.findUnique({ where: { email: 'patient1@example.com' } });
    patientAUserId = pAUser!.id;

    const pAProfile = await prisma.patient.findUnique({ where: { userId: patientAUserId } });

    // Seed test invoices for Hospital A and Hospital B
    const invA = await prisma.invoice.create({
      data: {
        hospitalId: hospitalAId,
        patientId: pAProfile!.id,
        invoiceNumber: `INV-TEST-A-${Date.now()}`,
        subtotal: 1000.00,
        tax: 50.00,
        discount: 0.00,
        total: 1050.00,
        status: 'FINAL',
      },
    });
    testInvoiceAId = invA.id;

    const invB = await prisma.invoice.create({
      data: {
        hospitalId: hospitalBId,
        patientId: pAProfile!.id,
        invoiceNumber: `INV-TEST-B-${Date.now()}`,
        subtotal: 500.00,
        tax: 25.00,
        discount: 0.00,
        total: 525.00,
        status: 'FINAL',
      },
    });
    testInvoiceBId = invB.id;
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { invoiceId: { in: [testInvoiceAId, testInvoiceBId] } } });
    await prisma.invoice.deleteMany({ where: { id: { in: [testInvoiceAId, testInvoiceBId] } } });
    await app.close();
  });

  test('1. Stripe PaymentIntent creation enforces server-authoritative invoice total from PostgreSQL', async () => {
    const res = await request(app.getHttpServer())
      .post(`/invoices/${testInvoiceAId}/stripe-intent`)
      .set('Authorization', `Bearer ${hospitalAdminAToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.providerOrderId).toBeDefined();
    expect(res.body.data.amount).toBe(1050.00);
    expect(res.body.data.amountInMinorUnits).toBe(105000); // 1050 * 100
    expect(res.body.data.currency).toBe('INR');

    // Verify PENDING Payment transaction recorded in DB
    const paymentRecord = await prisma.payment.findFirst({ where: { invoiceId: testInvoiceAId, provider: 'STRIPE' } });
    expect(paymentRecord).toBeDefined();
    expect(paymentRecord?.status).toBe('PENDING');
  });

  test('2. Authoritative amount enforcement: Client-manipulated payload cannot alter computed payment total', async () => {
    // Attempting to post a manipulated body with total = 1.00
    const res = await request(app.getHttpServer())
      .post(`/invoices/${testInvoiceAId}/stripe-intent`)
      .set('Authorization', `Bearer ${hospitalAdminAToken}`)
      .send({ amount: 1.00, total: 1.00 }); // Client payload attempt

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(1050.00); // Strictly loaded from DB total 1050.00
    expect(res.body.data.amountInMinorUnits).toBe(105000);
  });

  test('3. Razorpay Order creation converts Decimal total to minor unit (paise) safely', async () => {
    const res = await request(app.getHttpServer())
      .post(`/invoices/${testInvoiceAId}/razorpay-order`)
      .set('Authorization', `Bearer ${hospitalAdminAToken}`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.providerOrderId).toBeDefined();
    expect(res.body.data.amount).toBe(105000); // ₹1050.00 = 105000 Paise
    expect(res.body.data.currency).toBe('INR');

    const paymentRecord = await prisma.payment.findFirst({ where: { invoiceId: testInvoiceAId, provider: 'RAZORPAY' } });
    expect(paymentRecord).toBeDefined();
    expect(paymentRecord?.status).toBe('PENDING');
  });

  test('4. Cross-tenant invoice payment initiation is strictly denied (403)', async () => {
    // Hospital Admin B attempting to initiate Stripe intent for Hospital A's invoice
    const res = await request(app.getHttpServer())
      .post(`/invoices/${testInvoiceAId}/stripe-intent`)
      .set('Authorization', `Bearer ${hospitalAdminBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('5. Valid Razorpay checkout signature verification confirms payment and updates invoice status', async () => {
    const orderId = `order_test_${Date.now()}`;
    const paymentId = `pay_test_${Date.now()}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'test_razorpay_key_secret';

    // Calculate valid checkout signature
    const signature = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

    // Link order to test invoice
    await prisma.payment.create({
      data: {
        hospitalId: hospitalAId,
        patientId: (await prisma.patient.findFirst({ where: { hospitalId: hospitalAId } }))!.id,
        invoiceId: testInvoiceAId,
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        amount: 1050.00,
        status: 'PENDING',
      },
    });

    const res = await request(app.getHttpServer())
      .post('/invoices/razorpay-verify')
      .set('Authorization', `Bearer ${hospitalAdminAToken}`)
      .send({
        invoiceId: testInvoiceAId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: testInvoiceAId } });
    expect(updatedInvoice?.status).toBe('PAID');
    expect(updatedInvoice?.paymentMethod).toBe('RAZORPAY');
  });

  test('6. Forged Razorpay checkout signature is rejected with 403 Forbidden', async () => {
    const res = await request(app.getHttpServer())
      .post('/invoices/razorpay-verify')
      .set('Authorization', `Bearer ${hospitalAdminAToken}`)
      .send({
        invoiceId: testInvoiceAId,
        razorpay_order_id: 'order_fake',
        razorpay_payment_id: 'pay_fake',
        razorpay_signature: 'forged_signature_hash',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_SIGNATURE');
  });

  test('7. Stripe webhook with valid signature processes payment idempotently', async () => {
    const orderId = `pi_stripe_test_${Date.now()}`;
    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'test_stripe_webhook_secret';

    await prisma.payment.create({
      data: {
        hospitalId: hospitalBId,
        patientId: (await prisma.patient.findFirst({ where: { hospitalId: hospitalBId } }))!.id,
        invoiceId: testInvoiceBId,
        provider: 'STRIPE',
        providerOrderId: orderId,
        amount: 525.00,
        status: 'PENDING',
      },
    });

    const payload = JSON.stringify({
      id: 'evt_test_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: orderId, latest_charge: `ch_${Date.now()}` } },
    });

    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const res1 = await request(app.getHttpServer())
      .post('/invoices/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.received).toBe(true);

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: testInvoiceBId } });
    expect(updatedInvoice?.status).toBe('PAID');

    // Duplicate webhook payload should process idempotently
    const res2 = await request(app.getHttpServer())
      .post('/invoices/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.body.idempotent).toBe(true);
  });

  test('8. Invalid Stripe webhook signature is rejected', async () => {
    const res = await request(app.getHttpServer())
      .post('/invoices/webhooks/stripe')
      .set('stripe-signature', 'invalid_sig_hash')
      .send({ type: 'payment_intent.succeeded' });

    expect(res.status).toBe(403);
  });
});
