import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService, escapeHtml } from './pdf.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PrescriptionPdfGenerator {
  private readonly logger = new Logger(PrescriptionPdfGenerator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
  ) {}

  async generatePrescriptionPdf(prescriptionId: string, hospitalId: string): Promise<{ buffer: Buffer; storageKey: string }> {
    const storageKey = `${hospitalId}/PDF_DOCUMENT/prescription_${prescriptionId}.pdf`;

    // Check if valid cached PDF artifact already exists
    try {
      const existingBuffer = await this.storageService.getInternalFile(storageKey);
      if (existingBuffer && existingBuffer.length > 0) {
        this.logger.log(`Returning cached Prescription PDF for ${prescriptionId}`);
        return { buffer: existingBuffer, storageKey };
      }
    } catch (e) {
      // Not cached, generate new PDF
    }

    const rx = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        hospital: true,
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
        items: { include: { medicine: true } },
      },
    });

    if (!rx) {
      throw new NotFoundException(`Prescription ${prescriptionId} not found`);
    }

    const hospitalName = escapeHtml(rx.hospital?.name || 'MedCore Hospital System');
    const hospitalAddress = escapeHtml(rx.hospital?.address || '');
    const hospitalPhone = escapeHtml(rx.hospital?.phone || '');

    const doctorName = escapeHtml(`Dr. ${rx.doctor?.user?.firstName || ''} ${rx.doctor?.user?.lastName || ''}`);
    const doctorSpec = escapeHtml(rx.doctor?.specialisation || 'General Medicine');
    const doctorLicense = escapeHtml(rx.doctor?.licenseNumber || 'REG-MED-2026');

    const patientName = escapeHtml(`${rx.patient?.user?.firstName || ''} ${rx.patient?.user?.lastName || ''}`);
    const patientMrn = escapeHtml(rx.patient?.mrn || 'MRN-N/A');
    const rxDate = rx.createdAt ? rx.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const itemsHtml = rx.items
      .map(
        (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(item.medicine?.name || 'Medicine')}</strong><br><small>${escapeHtml(item.form)}</small></td>
          <td>${escapeHtml(item.dosage)}</td>
          <td>${escapeHtml(item.frequency)}</td>
          <td>${item.durationDays} days</td>
          <td>${escapeHtml(item.instructions || '-')}</td>
        </tr>
      `,
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .hospital-title { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
          .hospital-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
          .rx-badge { font-size: 28px; font-weight: bold; color: #0284c7; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
          .meta-item { line-height: 1.5; }
          .meta-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .meta-val { font-size: 13px; font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
          th { background: #0284c7; color: #ffffff; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
          .signature-box { text-align: center; width: 200px; border-top: 1px solid #94a3b8; padding-top: 8px; font-size: 11px; font-weight: bold; color: #334155; }
          .notice { font-size: 10px; color: #94a3b8; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hospital-title">${hospitalName}</div>
            <div class="hospital-sub">${hospitalAddress} | Phone: ${hospitalPhone}</div>
          </div>
          <div class="rx-badge">℞</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Patient Details</div>
            <div class="meta-val">${patientName}</div>
            <div style="font-size:11px; color:#475569;">MRN: ${patientMrn}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Prescribing Doctor</div>
            <div class="meta-val">${doctorName}</div>
            <div style="font-size:11px; color:#475569;">${doctorSpec} (${doctorLicense})</div>
          </div>
        </div>

        <div style="margin-bottom: 10px; font-weight: bold; color: #0f172a; font-size: 14px;">Prescribed Medications</div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 30%;">Medicine</th>
              <th style="width: 15%;">Dosage</th>
              <th style="width: 15%;">Frequency</th>
              <th style="width: 12%;">Duration</th>
              <th style="width: 23%;">Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="footer">
          <div class="notice">
            Date: ${rxDate}<br>
            * Valid for fulfillment at authorized hospital pharmacies only.
          </div>
          <div class="signature-box">
            ${doctorName}<br>
            <span style="font-size:9px; font-weight:normal; color:#64748b;">Authorized Physician Signature</span>
          </div>
        </div>
      </body>
      </html>
    `;

    const pdfBuffer = await this.pdfService.generatePdfFromHtml(html);
    await this.storageService.saveInternalFile(pdfBuffer, storageKey, 'application/pdf');

    return { buffer: pdfBuffer, storageKey };
  }
}
