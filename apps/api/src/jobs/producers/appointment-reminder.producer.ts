import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const APPOINTMENT_REMINDERS_QUEUE = 'appointment-reminders';

export interface AppointmentReminderPayload {
  appointmentId: string;
  hospitalId: string;
  reminderType: '24h' | '1h';
}

@Injectable()
export class AppointmentReminderProducer {
  private readonly logger = new Logger(AppointmentReminderProducer.name);

  constructor(
    @InjectQueue(APPOINTMENT_REMINDERS_QUEUE)
    private readonly reminderQueue: Queue<AppointmentReminderPayload>,
  ) {}

  /**
   * Schedules 24h and 1h reminder jobs deterministically based on appointment time.
   */
  async scheduleReminders(appointmentId: string, hospitalId: string, appointmentDateTime: Date) {
    const now = Date.now();
    const apptTime = appointmentDateTime.getTime();

    // 24 Hours Reminder (24 * 60 * 60 * 1000 = 86,400,000 ms)
    const time24h = apptTime - 24 * 60 * 60 * 1000;
    if (time24h > now) {
      const delay = time24h - now;
      const jobId = `appt-${appointmentId}-rem-24h`;
      await this.reminderQueue.add(
        'send-reminder',
        { appointmentId, hospitalId, reminderType: '24h' },
        {
          jobId,
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(`Scheduled 24h reminder for appointment ${appointmentId} (delay: ${delay}ms)`);
    }

    // 1 Hour Reminder (60 * 60 * 1000 = 3,600,000 ms)
    const time1h = apptTime - 60 * 60 * 1000;
    if (time1h > now) {
      const delay = time1h - now;
      const jobId = `appt-${appointmentId}-rem-1h`;
      await this.reminderQueue.add(
        'send-reminder',
        { appointmentId, hospitalId, reminderType: '1h' },
        {
          jobId,
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
      this.logger.log(`Scheduled 1h reminder for appointment ${appointmentId} (delay: ${delay}ms)`);
    }
  }

  /**
   * Removes scheduled delayed reminder jobs if the appointment is cancelled.
   */
  async cancelReminders(appointmentId: string) {
    const job24hId = `appt-${appointmentId}-rem-24h`;
    const job1hId = `appt-${appointmentId}-rem-1h`;

    const job24h = await this.reminderQueue.getJob(job24hId);
    if (job24h) {
      await job24h.remove().catch(() => {});
    }

    const job1h = await this.reminderQueue.getJob(job1hId);
    if (job1h) {
      await job1h.remove().catch(() => {});
    }

    this.logger.log(`Cancelled reminder jobs for appointment ${appointmentId}`);
  }
}
