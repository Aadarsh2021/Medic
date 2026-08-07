import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService, escapeHtml } from './pdf.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class InvoicePdfGenerator {
  private readonly logger = new Logger(InvoicePdfGenerator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
  ) {}

  async generateInvoicePdf(invoiceId: string, hospitalId: string): Promise<{ buffer: Buffer; storageKey: string }> {
    const storageKey = `${hospitalId}/PDF_DOCUMENT/invoice_${invoiceId}.pdf`;

    // Check if valid cached PDF artifact already exists
    try {
      const existingBuffer = await this.storageService.getInternalFile(storageKey);
      if (existingBuffer && existingBuffer.length > 0) {
        this.logger.log(`Returning cached Invoice PDF for ${invoiceId}`);
        return { buffer: existingBuffer, storageKey };
      }
    } catch (e) {
      // Not cached, generate new PDF
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        hospital: true,
        patient: { include: { user: true } },
        items: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const hospitalName = escapeHtml(invoice.hospital?.name || 'MedCore Hospital System');
    const hospitalAddress = escapeHtml(invoice.hospital?.address || '');
    const hospitalPhone = escapeHtml(invoice.hospital?.phone || '');

    const patientName = escapeHtml(`${invoice.patient?.user?.firstName || ''} ${invoice.patient?.user?.lastName || ''}`);
    const patientMrn = escapeHtml(invoice.patient?.mrn || 'MRN-N/A');
    const invoiceNumber = escapeHtml(invoice.invoiceNumber);
    const invoiceDate = invoice.createdAt ? invoice.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const status = escapeHtml(invoice.status);

    const fmtMoney = (val: any) => `$${Number(val || 0).toFixed(2)}`;

    const itemsHtml = invoice.items
      .map(
        (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${escapeHtml(item.department)}</strong></td>
          <td>${escapeHtml(item.description)}</td>
          <td style="text-align:center;">${item.quantity}</td>
          <td style="text-align:right;">${fmtMoney(item.unitPrice)}</td>
          <td style="text-align:right; font-weight:bold;">${fmtMoney(item.totalAmount)}</td>
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
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .hospital-title { font-size: 22px; font-weight: bold; color: #0f172a; margin: 0; }
          .hospital-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
          .inv-badge { text-align: right; }
          .inv-title { font-size: 24px; font-weight: bold; color: #0f172a; }
          .status-tag { display: inline-block; padding: 4px 10px; font-size: 11px; font-weight: bold; border-radius: 4px; background: #e2e8f0; color: #0f172a; margin-top: 4px; }
          .status-PAID { background: #dcfce7; color: #166534; }
          .status-DRAFT { background: #fef9c3; color: #854d0e; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 20px; }
          .meta-item { line-height: 1.5; }
          .meta-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; }
          .meta-val { font-size: 13px; font-weight: 600; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }
          th { background: #0f172a; color: #ffffff; text-align: left; padding: 10px; font-size: 11px; text-transform: uppercase; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
          tr:nth-child(even) { background: #f8fafc; }
          .totals-wrap { display: flex; justify-content: flex-end; margin-top: 10px; }
          .totals-table { width: 280px; border-collapse: collapse; }
          .totals-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
          .totals-table .grand-total { font-size: 15px; font-weight: bold; background: #f1f5f9; color: #0f172a; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 10px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hospital-title">${hospitalName}</div>
            <div class="hospital-sub">${hospitalAddress} | Phone: ${hospitalPhone}</div>
          </div>
          <div class="inv-badge">
            <div class="inv-title">INVOICE</div>
            <div style="font-size:12px; font-weight:bold; color:#475569;"># ${invoiceNumber}</div>
            <div class="status-tag status-${status}">${status}</div>
          </div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Billed To</div>
            <div class="meta-val">${patientName}</div>
            <div style="font-size:11px; color:#475569;">MRN: ${patientMrn}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Billing Date & Reference</div>
            <div class="meta-val">Date: ${invoiceDate}</div>
            <div style="font-size:11px; color:#475569;">Payment Method: ${escapeHtml(invoice.paymentMethod || 'PENDING')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 25%;">Department</th>
              <th style="width: 40%;">Description</th>
              <th style="width: 10%; text-align:center;">Qty</th>
              <th style="width: 10%; text-align:right;">Price</th>
              <th style="width: 10%; text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals-wrap">
          <table class="totals-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align:right;">${fmtMoney(invoice.subtotal)}</td>
            </tr>
            <tr>
              <td>Tax:</td>
              <td style="text-align:right;">${fmtMoney(invoice.tax)}</td>
            </tr>
            <tr>
              <td>Discount:</td>
              <td style="text-align:right;">-${fmtMoney(invoice.discount)}</td>
            </tr>
            <tr class="grand-total">
              <td>Total Amount:</td>
              <td style="text-align:right;">${fmtMoney(invoice.total)}</td>
            </tr>
          </table>
        </div>

        <div class="footer">
          Thank you for choosing ${hospitalName}. For billing inquiries, please contact our accountant office.<br>
          This is an official computer-generated medical invoice document.
        </div>
      </body>
      </html>
    `;

    const pdfBuffer = await this.pdfService.generatePdfFromHtml(html);
    await this.storageService.saveInternalFile(pdfBuffer, storageKey, 'application/pdf');

    return { buffer: pdfBuffer, storageKey };
  }
}
