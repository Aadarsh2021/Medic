export interface EmailPayload {
  to: string;
  subject: string;
  template: 'APPOINTMENT_REMINDER' | 'INVOICE_RECEIPT' | 'PRESCRIPTION_READY' | 'PASSWORD_RESET';
  data: Record<string, any>;
}

export interface EmailDeliveryResult {
  success: boolean;
  provider: 'RESEND' | 'DEVELOPMENT';
  status: 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER';
  messageId?: string;
  error?: string;
}

export abstract class EmailProvider {
  abstract sendEmail(payload: EmailPayload): Promise<EmailDeliveryResult>;
  abstract getStatus(): 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER';
}
