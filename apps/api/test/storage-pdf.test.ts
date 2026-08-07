import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { PrescriptionPdfGenerator } from '../src/pdf/pdf-prescription.generator';
import { InvoicePdfGenerator } from '../src/pdf/pdf-invoice.generator';
import { PdfGenerationProcessor } from '../src/jobs/processors/pdf-generation.processor';
import { escapeHtml } from '../src/pdf/pdf.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * CHECKPOINT 5: SECURE FILE UPLOADS, STORAGE ABSTRACTION & PUPPETEER PDF ENGINE TEST SUITE
 * Tests against live PostgreSQL 16 & Redis 7:
 * - Content signature (magic bytes) validation & Sharp image processing
 * - Path traversal protection & file size enforcement
 * - Multi-tenant & Patient file authorization
 * - Real Puppeteer Prescription & Invoice PDF rendering
 * - BullMQ PDF Processor & HTML template escaping
 */
describe('CHECKPOINT 5: Upload Security & Puppeteer PDF Engine Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storageService: StorageService;
  let rxGenerator: PrescriptionPdfGenerator;
  let invGenerator: InvoicePdfGenerator;
  let pdfProcessor: PdfGenerationProcessor;

  let superAdminToken: string;
  let hospitalAdminAToken: string;
  let hospitalAdminBToken: string;
  let patientAToken: string;
  let patientBToken: string;

  let hospitalAId: string;
  let hospitalBId: string;
  let patientAUserId: string;
  let patientBUserId: string;

  beforeAll(async () => {
    jest.setTimeout(45000);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    storageService = app.get<StorageService>(StorageService);
    rxGenerator = app.get<PrescriptionPdfGenerator>(PrescriptionPdfGenerator);
    invGenerator = app.get<InvoicePdfGenerator>(InvoicePdfGenerator);
    pdfProcessor = app.get<PdfGenerationProcessor>(PdfGenerationProcessor);

    const loginUser = async (email: string) => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'Password123!' });
      if (!res.body?.data?.accessToken) {
        console.error('LOGIN FAILED for:', email, 'Status:', res.status, 'Body:', JSON.stringify(res.body));
      }
      return res.body?.data?.accessToken;
    };

    const hA = await prisma.hospital.findFirst({ where: { code: 'MED-CITY' } });
    const hB = await prisma.hospital.findFirst({ where: { code: 'APEX-HEALTH' } });
    hospitalAId = hA!.id;
    hospitalBId = hB ? hB.id : hA!.id;

    // Ensure dedicated user for Hospital B cross-tenant download verification
    const passHash = await bcrypt.hash('Password123!', 10);
    await prisma.user.upsert({
      where: { email: 'admin.b@hospital-b.org' },
      update: { hospital: { connect: { id: hospitalBId } } },
      create: {
        email: 'admin.b@hospital-b.org',
        passwordHash: passHash,
        firstName: 'Admin',
        lastName: 'HospitalB',
        phone: '+91 99999 99999',
        role: 'HOSPITAL_ADMIN',
        hospital: { connect: { id: hospitalBId } },
        isVerified: true,
      },
    });

    superAdminToken = await loginUser('superadmin@medcore.org');
    hospitalAdminAToken = await loginUser('admin@medcore-city.org');
    hospitalAdminBToken = await loginUser('admin.b@hospital-b.org');
    patientAToken = await loginUser('patient1@example.com');
    patientBToken = await loginUser('patient2@example.com');

    const pAUser = await prisma.user.findUnique({ where: { email: 'patient1@example.com' } });
    const pBUser = await prisma.user.findUnique({ where: { email: 'patient2@example.com' } });
    patientAUserId = pAUser!.id;
    patientBUserId = pBUser!.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Upload Security & Content Validation
  // ─────────────────────────────────────────────────────────────────────────────

  test('1. Valid PNG upload is accepted, magic-bytes verified, and Sharp re-encoded', async () => {
    // 1x1 valid PNG buffer
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const res = await request(app.getHttpServer())
      .post('/files/upload?category=PROFILE_IMAGE')
      .set('Authorization', `Bearer ${patientAToken}`)
      .attach('file', validPngBuffer, 'avatar.png');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.storageKey).toContain('PROFILE_IMAGE');
    expect(res.body.data.mimeType).toBe('image/png');
  });

  test('2. Unsupported file extension (.exe) is rejected with 400', async () => {
    const exeBuffer = Buffer.from('MZ90003000000', 'utf8');

    const res = await request(app.getHttpServer())
      .post('/files/upload?category=PROFILE_IMAGE')
      .set('Authorization', `Bearer ${patientAToken}`)
      .attach('file', exeBuffer, 'malicious.exe');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE_TYPE');
  });

  test('3. Oversized file exceeding category limit (2MB) is rejected with 400', async () => {
    const oversizedBuffer = Buffer.alloc(3 * 1024 * 1024); // 3MB

    const res = await request(app.getHttpServer())
      .post('/files/upload?category=PROFILE_IMAGE')
      .set('Authorization', `Bearer ${patientAToken}`)
      .attach('file', oversizedBuffer, 'large.png');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  test('4. Malicious path traversal filename is sanitized to safe storage key', async () => {
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    const res = await request(app.getHttpServer())
      .post('/files/upload?category=PROFILE_IMAGE')
      .set('Authorization', `Bearer ${patientAToken}`)
      .attach('file', validPngBuffer, '../../etc/passwd.png');

    expect(res.status).toBe(201);
    expect(res.body.data.storageKey).not.toContain('..');
    expect(res.body.data.storageKey).not.toContain('/etc/');
  });

  test('5. File extension / binary signature mismatch (.png containing text) is rejected', async () => {
    const fakePngBuffer = Buffer.from('Plain text masquerading as PNG image', 'utf8');

    const res = await request(app.getHttpServer())
      .post('/files/upload?category=PROFILE_IMAGE')
      .set('Authorization', `Bearer ${patientAToken}`)
      .attach('file', fakePngBuffer, 'fake.png');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_FILE_CONTENT');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6 & 7. Tenant & Patient File Isolation
  // ─────────────────────────────────────────────────────────────────────────────

  test('6 & 7. Cross-hospital & cross-patient file download access is strictly denied (403)', async () => {
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    // Patient A uploads a file under Hospital A
    const uploadRes = await request(app.getHttpServer())
      .post('/files/upload?category=PROFILE_IMAGE')
      .set('Authorization', `Bearer ${patientAToken}`)
      .attach('file', validPngBuffer, 'patientA.png');

    const fileId = uploadRes.body.data.id;

    // Patient A can download their file -> 200 OK
    const selfDownload = await request(app.getHttpServer())
      .get(`/files/${fileId}/download`)
      .set('Authorization', `Bearer ${patientAToken}`);
    expect(selfDownload.status).toBe(200);

    // Patient B (different user) attempting to download Patient A's private file -> 403 FORBIDDEN
    const patientBDownload = await request(app.getHttpServer())
      .get(`/files/${fileId}/download`)
      .set('Authorization', `Bearer ${patientBToken}`);
    expect(patientBDownload.status).toBe(403);
    expect(patientBDownload.body.error.code).toBe('FORBIDDEN');

    // Hospital Admin B (different hospital) attempting to download Hospital A's file -> 403 FORBIDDEN
    const hospitalBDownload = await request(app.getHttpServer())
      .get(`/files/${fileId}/download`)
      .set('Authorization', `Bearer ${hospitalAdminBToken}`);
    expect(hospitalBDownload.status).toBe(403);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8 - 18. Puppeteer PDF Generation Engine & Templates
  // ─────────────────────────────────────────────────────────────────────────────

  test('8, 9, 11. Prescription PDF generator produces valid PDF with %PDF signature', async () => {
    const rx = await prisma.prescription.findFirst({
      where: { hospitalId: hospitalAId },
    });

    const result = await rxGenerator.generatePrescriptionPdf(rx!.id, hospitalAId);

    expect(result.buffer).toBeDefined();
    expect(result.buffer.length).toBeGreaterThan(1000);

    // Verify %PDF binary header signature
    const header = result.buffer.subarray(0, 4).toString('utf8');
    expect(header).toBe('%PDF');
    expect(result.storageKey).toContain(`prescription_${rx!.id}.pdf`);
  });

  test('10, 11. Invoice PDF generator produces valid PDF with %PDF signature', async () => {
    const invoice = await prisma.invoice.findFirst({
      where: { hospitalId: hospitalAId },
    });

    const result = await invGenerator.generateInvoicePdf(invoice!.id, hospitalAId);

    expect(result.buffer).toBeDefined();
    expect(result.buffer.length).toBeGreaterThan(1000);

    // Verify %PDF binary header signature
    const header = result.buffer.subarray(0, 4).toString('utf8');
    expect(header).toBe('%PDF');
    expect(result.storageKey).toContain(`invoice_${invoice!.id}.pdf`);
  });

  test('16. BullMQ PDF Processor executes real Puppeteer PDF generation', async () => {
    const rx = await prisma.prescription.findFirst({ where: { hospitalId: hospitalAId } });

    const job = {
      data: {
        documentId: rx!.id,
        hospitalId: hospitalAId,
        type: 'PRESCRIPTION',
      },
    } as any;

    const processResult = await pdfProcessor.process(job);
    expect(processResult.success).toBe(true);
    expect(processResult.type).toBe('PRESCRIPTION');
    expect(processResult.size).toBeGreaterThan(1000);
  });

  test('17. HTML-sensitive values are safely escaped against XSS injection', () => {
    const maliciousText = '<script>alert("XSS")</script>&"\'';
    const escaped = escapeHtml(maliciousText);

    expect(escaped).not.toContain('<script>');
    expect(escaped).toContain('&lt;script&gt;');
    expect(escaped).toContain('&amp;');
    expect(escaped).toContain('&quot;');
    expect(escaped).toContain('&#039;');
  });

  test('18. Unknown PDF job type is safely rejected', async () => {
    const dummyJob = {
      data: {
        documentId: '123',
        hospitalId: hospitalAId,
        type: 'UNKNOWN_TYPE',
      },
    } as any;

    await expect(pdfProcessor.process(dummyJob)).rejects.toThrow();
  });
});
