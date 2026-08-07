import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, EmailPayload, EmailDeliveryResult } from '../interfaces/email-provider.interface';
import { Resend } from 'resend';

@Injectable()
export class ResendEmailAdapter implements EmailProvider {
  private readonly logger = new Logger(ResendEmailAdapter.name);
  private resendClient: Resend | null = null;
  private readonly fromEmail: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'notifications@medcore.org';
    if (apiKey && apiKey.trim().length > 0) {
      this.resendClient = new Resend(apiKey);
    }
  }

  getStatus(): 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER' {
    return this.resendClient ? 'CONFIGURED' : 'DEVELOPMENT_ADAPTER';
  }

  async sendEmail(payload: EmailPayload): Promise<EmailDeliveryResult> {
    const sanitizedHtml = this.generateHtml(payload);

    if (this.resendClient) {
      try {
        const { data, error } = await this.resendClient.emails.send({
          from: this.fromEmail,
          to: [payload.to],
          subject: payload.subject,
          html: sanitizedHtml,
        });

        if (error) {
          this.logger.error(`Resend email delivery failed: ${error.message}`);
          return {
            success: false,
            provider: 'RESEND',
            status: 'CONFIGURED',
            error: error.message,
          };
        }

        return {
          success: true,
          provider: 'RESEND',
          status: 'CONFIGURED',
          messageId: data?.id,
        };
      } catch (err: any) {
        this.logger.error(`Resend SDK exception: ${err.message}`);
        return {
          success: false,
          provider: 'RESEND',
          status: 'CONFIGURED',
          error: err.message || 'Resend SDK exception',
        };
      }
    }

    // Development Adapter Fallback (Unconfigured mode)
    this.logger.log(
      `[DEV EMAIL ADAPTER] Recipient: ${payload.to} | Subject: ${payload.subject} | Template: ${payload.template}`,
    );
    return {
      success: true,
      provider: 'DEVELOPMENT',
      status: 'DEVELOPMENT_ADAPTER',
      // Explicitly DO NOT return a fake Resend provider message ID
    };
  }

  private generateHtml(payload: EmailPayload): string {
    const escape = (str: any) =>
      String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const recipientName = escape(payload.data.recipientName || 'Valued Patient');
    const hospitalName = escape(payload.data.hospitalName || 'MedCore Healthcare');

    switch (payload.template) {
      case 'APPOINTMENT_REMINDER':
        const apptDate = escape(payload.data.appointmentDate);
        const slotTime = escape(payload.data.slotTime);
        return `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Appointment Reminder — ${hospitalName}</h2>
          <p>Dear ${recipientName},</p>
          <p>This is a reminder for your upcoming appointment scheduled on <strong>${apptDate} at ${slotTime}</strong>.</p>
          <p>Please log in to your patient portal for further details.</p>
        </div>`;

      case 'INVOICE_RECEIPT':
        const invNum = escape(payload.data.invoiceNumber);
        const amount = escape(payload.data.amount);
        return `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Payment Receipt — ${hospitalName}</h2>
          <p>Dear ${recipientName},</p>
          <p>Your payment for Invoice <strong>${invNum}</strong> (Total: &#8377;${amount}) was received successfully.</p>
          <p>Log in to view or download your official PDF invoice.</p>
        </div>`;

      case 'PRESCRIPTION_READY':
        return `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Prescription Update — ${hospitalName}</h2>
          <p>Dear ${recipientName},</p>
          <p>Your prescription is now available in your MedCore Patient Portal.</p>
        </div>`;

      case 'PASSWORD_RESET':
        const otpCode = escape(payload.data.otpCode);
        return `<div style="font-family: sans-serif; padding: 20px;">
          <h2>Password Reset Verification Code</h2>
          <p>Dear User,</p>
          <p>Your password reset code is: <strong style="font-size: 20px;">${otpCode}</strong></p>
          <p>This code expires in 10 minutes.</p>
        </div>`;

      default:
        return `<p>Hello ${recipientName}, notification from ${hospitalName}.</p>`;
    }
  }
}
