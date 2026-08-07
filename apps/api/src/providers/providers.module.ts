import { Module, Global } from '@nestjs/common';
import { EmailProvider } from './interfaces/email-provider.interface';
import { SmsProvider } from './interfaces/sms-provider.interface';
import { ResendEmailAdapter } from './adapters/resend-email.adapter';
import { TwilioSmsAdapter } from './adapters/twilio-sms.adapter';
import { StripePaymentAdapter } from './adapters/stripe-payment.adapter';
import { RazorpayPaymentAdapter } from './adapters/razorpay-payment.adapter';

@Global()
@Module({
  providers: [
    ResendEmailAdapter,
    TwilioSmsAdapter,
    {
      provide: EmailProvider,
      useExisting: ResendEmailAdapter,
    },
    {
      provide: SmsProvider,
      useExisting: TwilioSmsAdapter,
    },
    StripePaymentAdapter,
    RazorpayPaymentAdapter,
  ],
  exports: [
    ResendEmailAdapter,
    TwilioSmsAdapter,
    EmailProvider,
    SmsProvider,
    StripePaymentAdapter,
    RazorpayPaymentAdapter,
  ],
})
export class ProvidersModule {}
