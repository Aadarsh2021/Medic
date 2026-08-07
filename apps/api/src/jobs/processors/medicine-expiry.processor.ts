import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MEDICINE_EXPIRY_QUEUE } from '../producers/medicine-expiry.producer';
import { NOTIFICATIONS_QUEUE, NotificationJobPayload } from './notification.processor';

@Processor(MEDICINE_EXPIRY_QUEUE)
export class MedicineExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(MedicineExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationQueue: Queue<NotificationJobPayload>,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    this.logger.log(`Executing medicine expiry scan (trigger: ${job.data?.trigger || 'SCHEDULED'})`);

    const todayStr = new Date().toISOString().split('T')[0];
    const thirtyDaysStr = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Fetch expired batches (expiryDate < todayStr)
    const expiredBatches = await this.prisma.medicineBatch.findMany({
      where: {
        expiryDate: { lt: todayStr },
        quantity: { gt: 0 },
      },
      include: {
        medicine: { include: { hospital: true } },
      },
    });

    // 2. Fetch batches expiring within 30 days (todayStr <= expiryDate <= thirtyDaysStr)
    const expiringSoonBatches = await this.prisma.medicineBatch.findMany({
      where: {
        expiryDate: {
          gte: todayStr,
          lte: thirtyDaysStr,
        },
        quantity: { gt: 0 },
      },
      include: {
        medicine: { include: { hospital: true } },
      },
    });

    this.logger.log(
      `Expiry Scan Results: ${expiredBatches.length} expired batches, ${expiringSoonBatches.length} batches expiring within 30 days`,
    );

    // Group alerts by hospital to respect hospital tenancy
    const hospitalAlerts: Record<string, { expired: string[]; expiringSoon: string[] }> = {};

    for (const batch of expiredBatches) {
      const hId = batch.medicine.hospitalId;
      if (!hospitalAlerts[hId]) hospitalAlerts[hId] = { expired: [], expiringSoon: [] };
      hospitalAlerts[hId].expired.push(
        `Batch ${batch.batchNumber} (${batch.medicine.name}) expired on ${batch.expiryDate} (Qty: ${batch.quantity})`,
      );
    }

    for (const batch of expiringSoonBatches) {
      const hId = batch.medicine.hospitalId;
      if (!hospitalAlerts[hId]) hospitalAlerts[hId] = { expired: [], expiringSoon: [] };
      hospitalAlerts[hId].expiringSoon.push(
        `Batch ${batch.batchNumber} (${batch.medicine.name}) expires on ${batch.expiryDate} (Qty: ${batch.quantity})`,
      );
    }

    // Dispatch notifications per hospital
    for (const [hospitalId, alerts] of Object.entries(hospitalAlerts)) {
      if (alerts.expired.length > 0) {
        await this.notificationQueue.add('send-notification', {
          hospitalId,
          channel: 'IN_APP',
          title: 'EXPIRED MEDICINE ALERT',
          message: `${alerts.expired.length} medicine batch(es) have expired! Details: ${alerts.expired.slice(0, 3).join('; ')}`,
        });
      }

      if (alerts.expiringSoon.length > 0) {
        await this.notificationQueue.add('send-notification', {
          hospitalId,
          channel: 'IN_APP',
          title: 'MEDICINE EXPIRING SOON ALERT',
          message: `${alerts.expiringSoon.length} medicine batch(es) expire within 30 days. Details: ${alerts.expiringSoon.slice(0, 3).join('; ')}`,
        });
      }
    }

    return {
      success: true,
      expiredCount: expiredBatches.length,
      expiringSoonCount: expiringSoonBatches.length,
      hospitalsNotified: Object.keys(hospitalAlerts).length,
    };
  }
}
