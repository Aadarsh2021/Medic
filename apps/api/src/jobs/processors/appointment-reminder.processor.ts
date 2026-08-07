import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { APPOINTMENT_REMINDERS_QUEUE, AppointmentReminderPayload } from '../producers/appointment-reminder.producer';
import { NOTIFICATIONS_QUEUE, NotificationJobPayload } from './notification.processor';

@Processor(APPOINTMENT_REMINDERS_QUEUE)
export class AppointmentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationQueue: Queue<NotificationJobPayload>,
  ) {
    super();
  }

  async process(job: Job<AppointmentReminderPayload>): Promise<any> {
    const { appointmentId, hospitalId, reminderType } = job.data;
    this.logger.log(`Processing ${reminderType} reminder for appointment ${appointmentId}`);

    // Re-verify authoritative appointment data from PostgreSQL
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    if (!appt) {
      this.logger.warn(`Appointment ${appointmentId} not found in database. Skipping reminder.`);
      return { skipped: true, reason: 'NOT_FOUND' };
    }

    if (appt.status === 'CANCELLED' || appt.status === 'COMPLETED') {
      this.logger.log(`Appointment ${appointmentId} status is ${appt.status}. Skipping stale reminder.`);
      return { skipped: true, reason: appt.status };
    }

    const patientUser = appt.patient?.user;
    if (!patientUser) {
      this.logger.warn(`Patient user record missing for appointment ${appointmentId}. Skipping.`);
      return { skipped: true, reason: 'PATIENT_USER_MISSING' };
    }

    const timeStr = `${appt.appointmentDate} at ${appt.slotTime}`;
    const title = `Appointment Reminder (${reminderType === '24h' ? 'Tomorrow' : 'In 1 Hour'})`;
    const message = `Reminder: You have an upcoming appointment on ${timeStr} with Dr. ${appt.doctor?.user?.lastName || ''}.`;

    // Dispatch notification to generic notification queue
    await this.notificationQueue.add('send-notification', {
      userId: patientUser.id,
      hospitalId,
      channel: 'IN_APP',
      title,
      message,
    });

    return { processed: true, appointmentId, reminderType };
  }
}
