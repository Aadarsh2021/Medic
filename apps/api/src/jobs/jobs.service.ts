import { Injectable, Logger } from '@nestjs/common';
import { AppointmentReminderProducer } from './producers/appointment-reminder.producer';
import { MedicineExpiryProducer } from './producers/medicine-expiry.producer';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NotificationJobPayload } from './processors/notification.processor';
import { PDF_GENERATION_QUEUE, PdfGenerationPayload } from './processors/pdf-generation.processor';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly reminderProducer: AppointmentReminderProducer,
    private readonly expiryProducer: MedicineExpiryProducer,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationQueue: Queue<NotificationJobPayload>,
    @InjectQueue(PDF_GENERATION_QUEUE)
    private readonly pdfQueue: Queue<PdfGenerationPayload>,
  ) {}

  async scheduleAppointmentReminders(appointmentId: string, hospitalId: string, appointmentDateTime: Date) {
    return this.reminderProducer.scheduleReminders(appointmentId, hospitalId, appointmentDateTime);
  }

  async cancelAppointmentReminders(appointmentId: string) {
    return this.reminderProducer.cancelReminders(appointmentId);
  }

  async triggerMedicineExpiryScan() {
    return this.expiryProducer.triggerExpiryScanNow();
  }

  async enqueueNotification(payload: NotificationJobPayload) {
    return this.notificationQueue.add('send-notification', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
  }

  async enqueuePdfGeneration(payload: PdfGenerationPayload) {
    return this.pdfQueue.add('generate-pdf', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
    });
  }
}
