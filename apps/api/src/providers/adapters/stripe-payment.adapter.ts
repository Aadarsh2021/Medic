import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentProvider,
  CreatePaymentIntentPayload,
  PaymentIntentResult,
  WebhookVerificationResult,
} from '../interfaces/payment-provider.interface';
import Stripe from 'stripe';

@Injectable()
export class StripePaymentAdapter implements PaymentProvider {
  private readonly logger = new Logger(StripePaymentAdapter.name);
  private stripeClient: Stripe | null = null;
  private readonly webhookSecret: string;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

    if (secretKey && secretKey.trim().length > 0) {
      this.stripeClient = new Stripe(secretKey, {
        apiVersion: '2024-11-20.acacia' as any,
      });
    }
  }

  getStatus(): 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER' {
    return this.stripeClient ? 'CONFIGURED' : 'DEVELOPMENT_ADAPTER';
  }

  async createPaymentIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntentResult> {
    if (this.stripeClient) {
      try {
        const intent = await this.stripeClient.paymentIntents.create({
          amount: payload.amount,
          currency: payload.currency.toLowerCase(),
          metadata: {
            invoiceId: payload.invoiceId,
            hospitalId: payload.hospitalId,
            patientId: payload.patientId,
          },
          description: payload.description || `Payment for Invoice ${payload.invoiceId}`,
        });

        return {
          providerOrderId: intent.id,
          clientSecret: intent.client_secret || undefined,
          status: 'PENDING',
          amount: payload.amount,
          currency: payload.currency,
          provider: 'STRIPE',
        };
      } catch (err: any) {
        this.logger.error(`Stripe PaymentIntent creation failed: ${err.message}`);
        throw new Error(`Stripe Payment Error: ${err.message}`);
      }
    }

    // Development Adapter Fallback
    const devOrderId = `stripe_pi_dev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.logger.log(
      `[DEV STRIPE ADAPTER] Invoice: ${payload.invoiceId} | Amount: ${payload.amount} ${payload.currency}`,
    );
    return {
      providerOrderId: devOrderId,
      clientSecret: `${devOrderId}_secret`,
      status: 'PENDING',
      amount: payload.amount,
      currency: payload.currency,
      provider: 'DEVELOPMENT',
    };
  }

  async verifyWebhookSignature(
    rawBody: string | Buffer,
    signatureHeader: string,
  ): Promise<WebhookVerificationResult> {
    if (this.stripeClient && this.webhookSecret) {
      try {
        const event = this.stripeClient.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);

        let providerPaymentId: string | undefined;
        let providerOrderId: string | undefined;
        let eventStatus: 'SUCCEEDED' | 'FAILED' = 'SUCCEEDED';

        if (event.type === 'payment_intent.succeeded') {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          providerOrderId = paymentIntent.id;
          providerPaymentId = paymentIntent.latest_charge as string || paymentIntent.id;
          eventStatus = 'SUCCEEDED';
        } else if (event.type === 'payment_intent.payment_failed') {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          providerOrderId = paymentIntent.id;
          eventStatus = 'FAILED';
        }

        return {
          isValid: true,
          eventPayload: event,
          providerOrderId,
          providerPaymentId,
          eventStatus,
        };
      } catch (err: any) {
        this.logger.error(`Stripe Webhook Signature Verification Failed: ${err.message}`);
        return {
          isValid: false,
          error: err.message,
        };
      }
    }

    // Development/Test Cryptographic HMAC Verification Fallback
    return this.verifyLocalSignature(rawBody, signatureHeader);
  }

  private verifyLocalSignature(rawBody: string | Buffer | any, signatureHeader: string): WebhookVerificationResult {
    const crypto = require('crypto');
    let bodyStr = '';
    if (Buffer.isBuffer(rawBody)) {
      bodyStr = rawBody.toString('utf8');
    } else if (typeof rawBody === 'object') {
      bodyStr = JSON.stringify(rawBody);
    } else {
      bodyStr = String(rawBody || '');
    }

    try {
      // In development/test mode, calculate HMAC SHA256 using test key or signatureHeader
      const expectedHmac = crypto
        .createHmac('sha256', this.webhookSecret || 'test_stripe_webhook_secret')
        .update(bodyStr)
        .digest('hex');

      const isMatch = signatureHeader === expectedHmac || signatureHeader.includes(expectedHmac);

      if (!isMatch) {
        return { isValid: false, error: 'Invalid Stripe signature HMAC' };
      }

      const parsed = JSON.parse(bodyStr);
      return {
        isValid: true,
        eventPayload: parsed,
        providerOrderId: parsed.data?.object?.id || parsed.id,
        providerPaymentId: parsed.data?.object?.latest_charge || parsed.data?.object?.id || parsed.id,
        eventStatus: parsed.type?.includes('failed') ? 'FAILED' : 'SUCCEEDED',
      };
    } catch (err: any) {
      return { isValid: false, error: 'Stripe signature parsing exception' };
    }
  }
}
