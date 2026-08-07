import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StripePaymentAdapter } from '../../providers/adapters/stripe-payment.adapter';
import { RazorpayPaymentAdapter } from '../../providers/adapters/razorpay-payment.adapter';

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private stripePaymentAdapter: StripePaymentAdapter,
    private razorpayPaymentAdapter: RazorpayPaymentAdapter,
  ) {}

  async getInvoices(user: any, filterPatientId?: string, filterHospitalId?: string, status?: string) {
    const where: any = {};

    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (patient) where.patientId = patient.id;
    } else if (filterPatientId) {
      where.patientId = filterPatientId;
    }

    if (status) where.status = status;

    if (filterHospitalId) {
      where.hospitalId = filterHospitalId;
    } else if (user.role !== 'SUPER_ADMIN' && user.hospitalId) {
      where.hospitalId = user.hospitalId;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax),
      discount: Number(inv.discount),
      total: Number(inv.total),
      items: inv.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalAmount: Number(item.totalAmount),
      })),
    }));
  }

  async getInvoiceById(id: string, user: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { patient: true },
    });

    if (!invoice) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });
    }

    // Hospital isolation
    if (user.role !== 'SUPER_ADMIN' && invoice.hospitalId !== user.hospitalId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Invoice belongs to a different hospital' },
      });
    }

    // Patient self-access: patients can only see their own invoices
    if (user.role === 'PATIENT' && invoice.patient.userId !== user.id) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this invoice' },
      });
    }

    return invoice;
  }

  async createInvoice(user: any, body: any, ipAddress?: string) {
    const { appointmentId, patientId, items, discount, hospitalId } = body;
    const targetHospitalId = hospitalId || user.hospitalId;

    let subtotal = 0;
    const invoiceItemsData = items.map((item: any) => {
      const itemTotal = Number(item.unitPrice) * Number(item.quantity || 1);
      subtotal += itemTotal;
      return {
        department: item.department || 'Consultation',
        description: item.description,
        quantity: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice),
        totalAmount: itemTotal,
      };
    });

    const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const disc = Number(discount || 0);
    const total = subtotal + tax - disc;

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const invoice = await this.prisma.invoice.create({
      data: {
        hospitalId: targetHospitalId,
        patientId,
        appointmentId: appointmentId || null,
        invoiceNumber,
        subtotal,
        tax,
        discount: disc,
        total,
        status: 'FINAL',
        items: {
          create: invoiceItemsData,
        },
      },
      include: { items: true },
    });

    await this.auditService.createAuditLog(
      user.id,
      targetHospitalId,
      'CREATE',
      'Invoice',
      invoice.id,
      `Generated invoice ${invoiceNumber} for total ₹${total}`,
      ipAddress,
    );

    return {
      ...invoice,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      items: invoice.items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        totalAmount: Number(item.totalAmount),
      })),
    };
  }

  async payInvoice(id: string, body: { paymentMethod?: string; paymentId?: string }, user: any, ipAddress?: string) {
    const { paymentMethod, paymentId } = body;
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });

    if (!invoice) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paymentMethod: paymentMethod || 'STRIPE',
        paymentId: paymentId || `pay_${Date.now()}`,
        paidAt: new Date(),
      },
      include: { items: true },
    });

    await this.auditService.createAuditLog(
      user.id,
      invoice.hospitalId,
      'UPDATE',
      'Invoice',
      invoice.id,
      `Payment received via ${paymentMethod || 'STRIPE'}`,
      ipAddress,
    );

    return {
      ...updated,
      subtotal: Number(updated.subtotal),
      tax: Number(updated.tax),
      discount: Number(updated.discount),
      total: Number(updated.total),
    };
  }

  // ── STRIPE PAYMENT INTEGRATION ─────────────────────────────────────────────

  async createStripePaymentIntent(id: string, user: any) {
    const invoice = await this.getInvoiceById(id, user);

    if (invoice.status === 'PAID') {
      throw new BadRequestException({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'Invoice is already fully paid' },
      });
    }

    // Authoritative Amount Enforcement: Calculate minor units (paise/cents) directly from PostgreSQL DB record
    const amountInMinorUnits = Math.round(Number(invoice.total) * 100);

    const intentResult = await this.stripePaymentAdapter.createPaymentIntent({
      invoiceId: invoice.id,
      amount: amountInMinorUnits,
      currency: 'INR',
      hospitalId: invoice.hospitalId,
      patientId: invoice.patientId,
    });

    // Record PENDING Payment transaction
    await this.prisma.payment.create({
      data: {
        hospitalId: invoice.hospitalId,
        patientId: invoice.patientId,
        invoiceId: invoice.id,
        provider: 'STRIPE',
        providerOrderId: intentResult.providerOrderId,
        amount: invoice.total,
        currency: 'INR',
        status: 'PENDING',
      },
    });

    return {
      success: true,
      data: {
        providerOrderId: intentResult.providerOrderId,
        clientSecret: intentResult.clientSecret,
        amount: Number(invoice.total),
        amountInMinorUnits,
        currency: 'INR',
        provider: intentResult.provider,
      },
    };
  }

  // ── RAZORPAY PAYMENT INTEGRATION ───────────────────────────────────────────

  async createRazorpayOrder(id: string, user: any) {
    const invoice = await this.getInvoiceById(id, user);

    if (invoice.status === 'PAID') {
      throw new BadRequestException({
        success: false,
        error: { code: 'ALREADY_PAID', message: 'Invoice is already fully paid' },
      });
    }

    // Authoritative Amount Enforcement: ₹1.00 = 100 Paise
    const amountInPaise = Math.round(Number(invoice.total) * 100);

    const orderResult = await this.razorpayPaymentAdapter.createPaymentIntent({
      invoiceId: invoice.id,
      amount: amountInPaise,
      currency: 'INR',
      hospitalId: invoice.hospitalId,
      patientId: invoice.patientId,
    });

    // Record PENDING Payment transaction
    await this.prisma.payment.create({
      data: {
        hospitalId: invoice.hospitalId,
        patientId: invoice.patientId,
        invoiceId: invoice.id,
        provider: 'RAZORPAY',
        providerOrderId: orderResult.providerOrderId,
        amount: invoice.total,
        currency: 'INR',
        status: 'PENDING',
      },
    });

    return {
      success: true,
      data: {
        providerOrderId: orderResult.providerOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_demo',
        provider: orderResult.provider,
      },
    };
  }

  async verifyRazorpayCheckout(
    user: any,
    body: { invoiceId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) {
    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    const invoice = await this.getInvoiceById(invoiceId, user);

    const isValid = this.razorpayPaymentAdapter.verifyCheckoutSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Razorpay checkout signature verification failed' },
      });
    }

    // Transactionally update Payment and Invoice state
    await this.prisma.$transaction([
      this.prisma.payment.updateMany({
        where: { invoiceId: invoice.id, providerOrderId: razorpay_order_id },
        data: { status: 'SUCCEEDED', providerPaymentId: razorpay_payment_id },
      }),
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paymentMethod: 'RAZORPAY', paymentId: razorpay_payment_id, paidAt: new Date() },
      }),
    ]);

    return { success: true, message: 'Razorpay checkout verified and payment recorded' };
  }

  // ── WEBHOOK HANDLING & IDEMPOTENCY ─────────────────────────────────────────

  async handleStripeWebhook(rawBody: string | Buffer, signatureHeader: string) {
    const result = await this.stripePaymentAdapter.verifyWebhookSignature(rawBody, signatureHeader);

    if (!result.isValid) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Invalid Stripe signature' },
      });
    }

    if (result.eventStatus === 'SUCCEEDED' && result.providerOrderId) {
      // Idempotent processing check
      const existingPayment = await this.prisma.payment.findFirst({
        where: { providerOrderId: result.providerOrderId },
      });

      if (existingPayment && existingPayment.status === 'SUCCEEDED') {
        return { received: true, idempotent: true };
      }

      const invoiceId = existingPayment?.invoiceId;
      if (invoiceId) {
        await this.prisma.$transaction([
          this.prisma.payment.updateMany({
            where: { providerOrderId: result.providerOrderId },
            data: { status: 'SUCCEEDED', providerPaymentId: result.providerPaymentId || result.providerOrderId },
          }),
          this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: 'PAID',
              paymentMethod: 'STRIPE',
              paymentId: result.providerPaymentId || result.providerOrderId,
              paidAt: new Date(),
            },
          }),
        ]);
      }
    }

    return { received: true };
  }

  async handleRazorpayWebhook(rawBody: string | Buffer, signatureHeader: string) {
    const result = await this.razorpayPaymentAdapter.verifyWebhookSignature(rawBody, signatureHeader);

    if (!result.isValid) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'INVALID_SIGNATURE', message: 'Invalid Razorpay signature' },
      });
    }

    if (result.eventStatus === 'SUCCEEDED' && result.providerOrderId) {
      const existingPayment = await this.prisma.payment.findFirst({
        where: { providerOrderId: result.providerOrderId },
      });

      if (existingPayment && existingPayment.status === 'SUCCEEDED') {
        return { status: 'ok', idempotent: true };
      }

      const invoiceId = existingPayment?.invoiceId;
      if (invoiceId) {
        await this.prisma.$transaction([
          this.prisma.payment.updateMany({
            where: { providerOrderId: result.providerOrderId },
            data: { status: 'SUCCEEDED', providerPaymentId: result.providerPaymentId || result.providerOrderId },
          }),
          this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: 'PAID',
              paymentMethod: 'RAZORPAY',
              paymentId: result.providerPaymentId || result.providerOrderId,
              paidAt: new Date(),
            },
          }),
        ]);
      }
    }

    return { status: 'ok' };
  }

  async generateInvoicePdfHtml(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        hospital: true,
        patient: { include: { user: true } },
        items: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice record not found');
    }

    const itemRows = invoice.items
      .map(
        (item, index) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${index + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.department}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${item.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${Number(item.unitPrice).toFixed(2)}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${Number(item.totalAmount).toFixed(2)}</td>
      </tr>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Tax Invoice - ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; color: #334155; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .invoice-title { font-size: 24px; font-weight: bold; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f8fafc; text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; }
          .totals { margin-top: 20px; width: 300px; margin-left: auto; }
          .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
          .grand-total { font-weight: bold; font-size: 18px; border-top: 2px solid #0f172a; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="invoice-title">${invoice.hospital.name}</div>
            <div>${invoice.hospital.address} | Phone: ${invoice.hospital.phone}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 20px; font-weight: bold; color: #2563eb;">TAX INVOICE</div>
            <div>No: ${invoice.invoiceNumber}</div>
            <div>Date: ${new Date(invoice.createdAt).toLocaleDateString()}</div>
            <div>Status: <strong>${invoice.status}</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <strong>Billed To:</strong> ${invoice.patient.user.firstName} ${invoice.patient.user.lastName}<br>
          <strong>MRN:</strong> ${invoice.patient.mrn}<br>
          <strong>Contact:</strong> ${invoice.patient.user.phone}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Dept</th>
              <th>Description</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <div class="totals">
          <div><span>Subtotal:</span><span>₹${Number(invoice.subtotal).toFixed(2)}</span></div>
          <div><span>GST (5%):</span><span>₹${Number(invoice.tax).toFixed(2)}</span></div>
          <div><span>Discount:</span><span>-₹${Number(invoice.discount).toFixed(2)}</span></div>
          <div class="grand-total"><span>Total Amount:</span><span>₹${Number(invoice.total).toFixed(2)}</span></div>
        </div>

        <div style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
          Thank you for choosing ${invoice.hospital.name}. This is a computer-generated tax invoice.
        </div>
      </body>
      </html>
    `;
  }
}
