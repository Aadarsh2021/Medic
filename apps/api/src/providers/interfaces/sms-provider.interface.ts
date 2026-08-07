export interface SmsPayload {
  to: string;
  message: string;
}

export interface SmsDeliveryResult {
  success: boolean;
  provider: 'TWILIO' | 'DEVELOPMENT';
  status: 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER';
  messageSid?: string;
  error?: string;
}

export abstract class SmsProvider {
  abstract sendSms(payload: SmsPayload): Promise<SmsDeliveryResult>;
  abstract getStatus(): 'CONFIGURED' | 'UNCONFIGURED' | 'DEVELOPMENT_ADAPTER';
}
