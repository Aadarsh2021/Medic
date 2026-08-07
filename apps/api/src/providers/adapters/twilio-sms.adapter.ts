import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsPayload, SmsDeliveryResult } from '../interfaces/sms-provider.interface';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioSmsAdapter implements SmsProvider {
  private readonly logger = new Logger(TwilioSmsAdapter.name);
  private twilioClient: Twilio | null = null;
  private readonly fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || '+18005550199';

    if (accountSid && authToken && accountSid.trim().length > 0 && authToken.trim().length > 0) {
      this.twilioClient = new Twilio(accountSid, authToken);
    }
  }

  getStatus(): 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER' {
    return this.twilioClient ? 'CONFIGURED' : 'DEVELOPMENT_ADAPTER';
  }

  async sendSms(payload: SmsPayload): Promise<SmsDeliveryResult> {
    const formattedPhone = this.normalizePhoneNumber(payload.to);

    if (this.twilioClient) {
      try {
        const message = await this.twilioClient.messages.create({
          body: payload.message,
          from: this.fromNumber,
          to: formattedPhone,
        });

        return {
          success: true,
          provider: 'TWILIO',
          status: 'CONFIGURED',
          messageSid: message.sid,
        };
      } catch (err: any) {
        // Sanitize error message to prevent leaking Twilio Auth Tokens / SIDs
        const sanitizedError = (err.message || 'Twilio SDK error').replace(/AC[a-f0-9]{32}/gi, 'AC***');
        this.logger.error(`Twilio SMS delivery error: ${sanitizedError}`);
        return {
          success: false,
          provider: 'TWILIO',
          status: 'CONFIGURED',
          error: sanitizedError,
        };
      }
    }

    // Development Adapter Fallback
    this.logger.log(`[DEV SMS ADAPTER] To: ${formattedPhone} | Message: ${payload.message}`);
    return {
      success: true,
      provider: 'DEVELOPMENT',
      status: 'DEVELOPMENT_ADAPTER',
      // Do NOT return fake Twilio SID
    };
  }

  private normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    // Default to India country code +91 if 10-digit number
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    return `+${cleaned}`;
  }
}
