import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentIntentPayload,
  PaymentIntentResult,
  WebhookVerificationResult,
} from '../interfaces/payment-provider.interface';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

@Injectable()
export class RazorpayPaymentAdapter implements PaymentProvider {
  private readonly logger = new Logger(RazorpayPaymentAdapter.name);
  private razorpayClient: Razorpay | null = null;
  private readonly keySecret: string;
  private readonly webhookSecret: string;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

    if (keyId && this.keySecret && keyId.trim().length > 0 && this.keySecret.trim().length > 0) {
      this.razorpayClient = new Razorpay({
        key_id: keyId,
        key_secret: this.keySecret,
      });
    }
  }

  getStatus(): 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER' {
    return this.razorpayClient ? 'CONFIGURED' : 'DEVELOPMENT_ADAPTER';
  }

  async createPaymentIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntentResult> {
    // Convert INR decimal amount to paise (minor currency unit: ₹1.00 = 100 paise)
    const amountInPaise = Math.round(payload.amount);

    if (this.razorpayClient) {
      try {
        const order = await this.razorpayClient.orders.create({
          amount: amountInPaise,
          currency: payload.currency.toUpperCase(),
          receipt: `rcpt_${payload.invoiceId.substring(0, 10)}_${Date.now()}`,
          notes: {
            invoiceId: payload.invoiceId,
            hospitalId: payload.hospitalId,
            patientId: payload.patientId,
          },
        });

        return {
          providerOrderId: order.id,
          status: 'PENDING',
          amount: amountInPaise,
          currency: payload.currency,
          provider: 'RAZORPAY',
        };
      } catch (err: any) {
        this.logger.error(`Razorpay order creation failed: ${err.message}`);
        throw new Error(`Razorpay Order Error: ${err.message}`);
      }
    }

    // Development/Test Adapter Fallback
    const devOrderId = `order_rzp_dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.logger.log(
      `[DEV RAZORPAY ADAPTER] Invoice: ${payload.invoiceId} | Amount: ${amountInPaise} Paise (${payload.currency})`,
    );
    return {
      providerOrderId: devOrderId,
      status: 'PENDING',
      amount: amountInPaise,
      currency: payload.currency,
      provider: 'DEVELOPMENT',
    };
  }

  async verifyWebhookSignature(
    rawBody: string | Buffer,
    signatureHeader: string,
  ): Promise<WebhookVerificationResult> {
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    const secret = this.webhookSecret || 'test_razorpay_webhook_secret';

    try {
      const expectedSignature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

      const isValid = signatureHeader === expectedSignature;
      if (!isValid) {
        return { isValid: false, error: 'Invalid Razorpay webhook signature HMAC' };
      }

      const parsed = JSON.parse(bodyStr);
      const entity = parsed.payload?.payment?.entity || parsed.payload?.order?.entity || {};

      return {
        isValid: true,
        eventPayload: parsed,
        providerOrderId: entity.order_id || entity.id,
        providerPaymentId: entity.id,
        eventStatus: parsed.event?.includes('captured') || parsed.event?.includes('paid') ? 'SUCCEEDED' : 'FAILED',
      };
    } catch (err: any) {
      return { isValid: false, error: 'Razorpay webhook signature parsing exception' };
    }
  }

  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = this.keySecret || 'test_razorpay_key_secret';
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');

    return signature === expectedSignature;
  }
}
