import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';

export const NOTIFICATIONS_QUEUE = 'notifications';

export interface NotificationJobPayload {
  userId?: string;
  hospitalId: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  title: string;
  message: string;
}

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationJobPayload>): Promise<any> {
    const { userId, hospitalId, channel, title, message } = job.data;
    this.logger.log(`Processing ${channel} notification for hospital ${hospitalId}`);

    if (channel === 'IN_APP') {
      if (userId) {
        const notif = await this.prisma.notification.create({
          data: {
            userId,
            hospitalId,
            title,
            message,
            channel: 'IN_APP',
            isRead: false,
          },
        });
        this.logger.log(`Created IN_APP notification record ${notif.id}`);
        return { success: true, channel, notificationId: notif.id };
      }
      return { success: true, channel, note: 'No userId provided for IN_APP' };
    }

    if (channel === 'EMAIL' || channel === 'SMS') {
      // Channel Failure Isolation: Development adapter handles pending provider integration cleanly
      this.logger.log(
        `[DevAdapter] ${channel} dispatch pending Resend/Twilio provider integration. Recipient: ${userId || 'N/A'}, Title: ${title}`,
      );
      return { success: true, channel, status: 'PENDING_PROVIDER_INTEGRATION' };
    }

    throw new Error(`Unsupported notification channel: ${channel}`);
  }
}
