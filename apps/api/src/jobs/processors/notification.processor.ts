import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailProvider } from '../../providers/interfaces/email-provider.interface';
import { SmsProvider } from '../../providers/interfaces/sms-provider.interface';

export const NOTIFICATIONS_QUEUE = 'notifications';

export interface NotificationJobPayload {
  userId?: string;
  hospitalId: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  title: string;
  message: string;
  recipientEmail?: string;
  recipientPhone?: string;
}

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SmsProvider,
  ) {
    super();
  }

  async process(job: Job<NotificationJobPayload>): Promise<any> {
    const { userId, hospitalId, channel, title, message, recipientEmail, recipientPhone } = job.data;
    this.logger.log(`Processing ${channel} notification for hospital ${hospitalId}`);

    // IN_APP notification creation
    let inAppNotifId: string | undefined;
    if (userId) {
      try {
        const notif = await this.prisma.notification.create({
          data: {
            userId,
            hospitalId,
            title,
            message,
            channel: channel || 'IN_APP',
            isRead: false,
          },
        });
        inAppNotifId = notif.id;
        this.logger.log(`Created IN_APP notification record ${notif.id}`);
      } catch (err: any) {
        this.logger.error(`Failed to store IN_APP notification: ${err.message}`);
      }
    }

    if (channel === 'IN_APP') {
      return { success: true, channel, notificationId: inAppNotifId };
    }

    // EMAIL Channel Dispatch with Failure Isolation
    if (channel === 'EMAIL') {
      try {
        let to = recipientEmail;
        if (!to && userId) {
          const user = await this.prisma.user.findUnique({ where: { id: userId } });
          to = user?.email;
        }

        if (to) {
          const emailResult = await this.emailProvider.sendEmail({
            to,
            subject: title,
            template: 'APPOINTMENT_REMINDER',
            data: { recipientName: to, hospitalName: 'MedCore HMS', title, message },
          });

          return {
            success: true,
            channel: 'EMAIL',
            deliveryResult: emailResult,
            notificationId: inAppNotifId,
          };
        }
      } catch (err: any) {
        // Channel Failure Isolation: email failure logged without crashing worker
        this.logger.error(`Email delivery channel failed gracefully: ${err.message}`);
        return { success: false, channel: 'EMAIL', error: err.message, notificationId: inAppNotifId };
      }
    }

    // SMS Channel Dispatch with Failure Isolation
    if (channel === 'SMS') {
      try {
        let phone = recipientPhone;
        if (!phone && userId) {
          const user = await this.prisma.user.findUnique({ where: { id: userId } });
          phone = user?.phone;
        }

        if (phone) {
          const smsResult = await this.smsProvider.sendSms({
            to: phone,
            message: `${title}: ${message}`,
          });

          return {
            success: true,
            channel: 'SMS',
            deliveryResult: smsResult,
            notificationId: inAppNotifId,
          };
        }
      } catch (err: any) {
        // Channel Failure Isolation: SMS failure logged without crashing worker
        this.logger.error(`SMS delivery channel failed gracefully: ${err.message}`);
        return { success: false, channel: 'SMS', error: err.message, notificationId: inAppNotifId };
      }
    }

    return { success: true, channel, notificationId: inAppNotifId };
  }
}
