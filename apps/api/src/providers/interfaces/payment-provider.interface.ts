export interface CreatePaymentIntentPayload {
  invoiceId: string;
  amount: number; // In minor currency units (paise for INR, cents for USD)
  currency: string;
  hospitalId: string;
  patientId: string;
  description?: string;
}

export interface PaymentIntentResult {
  providerOrderId: string;
  clientSecret?: string;
  status: 'PENDING' | 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER';
  amount: number;
  currency: string;
  provider: 'STRIPE' | 'RAZORPAY' | 'DEVELOPMENT';
}

export interface WebhookVerificationResult {
  isValid: boolean;
  eventPayload?: any;
  providerPaymentId?: string;
  providerOrderId?: string;
  eventStatus?: 'SUCCEEDED' | 'FAILED';
  error?: string;
}

export abstract class PaymentProvider {
  abstract createPaymentIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntentResult>;
  abstract verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string): Promise<WebhookVerificationResult>;
  abstract getStatus(): 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER';
}
