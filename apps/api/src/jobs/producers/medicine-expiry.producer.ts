import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const MEDICINE_EXPIRY_QUEUE = 'medicine-expiry';

@Injectable()
export class MedicineExpiryProducer implements OnModuleInit {
  private readonly logger = new Logger(MedicineExpiryProducer.name);

  constructor(
    @InjectQueue(MEDICINE_EXPIRY_QUEUE)
    private readonly expiryQueue: Queue,
  ) {}

  async onModuleInit() {
    // In test environment, avoid auto-scheduling cron intervals that interfere with Jest runs
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    await this.registerDailyExpiryScan();
  }

  /**
   * Registers daily recurring scan job idempotently using stable repeat job key.
   */
  async registerDailyExpiryScan() {
    const repeatKey = 'medicine-expiry-daily-scan';
    // Remove stale repeatables first to guarantee idempotent registration across restarts
    const existingRepeatables = await this.expiryQueue.getRepeatableJobs();
    for (const job of existingRepeatables) {
      if (job.key === repeatKey || job.name === 'daily-expiry-scan') {
        await this.expiryQueue.removeRepeatableByKey(job.key);
      }
    }

    await this.expiryQueue.add(
      'daily-expiry-scan',
      { trigger: 'CRON_SCHEDULED', timestamp: new Date().toISOString() },
      {
        repeat: { pattern: '0 0 * * *' }, // Midnight daily
        jobId: repeatKey,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
    this.logger.log('Registered daily medicine expiry scan repeatable job');
  }

  /**
   * Immediately triggers an expiry scan for manual or test verification.
   */
  async triggerExpiryScanNow() {
    return await this.expiryQueue.add('daily-expiry-scan', {
      trigger: 'MANUAL_TRIGGER',
      timestamp: new Date().toISOString(),
    });
  }
}
