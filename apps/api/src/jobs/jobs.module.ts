import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APPOINTMENT_REMINDERS_QUEUE, AppointmentReminderProducer } from './producers/appointment-reminder.producer';
import { AppointmentReminderProcessor } from './processors/appointment-reminder.processor';
import { MEDICINE_EXPIRY_QUEUE, MedicineExpiryProducer } from './producers/medicine-expiry.producer';
import { MedicineExpiryProcessor } from './processors/medicine-expiry.processor';
import { NOTIFICATIONS_QUEUE, NotificationProcessor } from './processors/notification.processor';
import { PDF_GENERATION_QUEUE, PdfGenerationProcessor } from './processors/pdf-generation.processor';
import { PdfModule } from '../pdf/pdf.module';
import { JobsService } from './jobs.service';

@Global()
@Module({
  imports: [
    PdfModule,
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: APPOINTMENT_REMINDERS_QUEUE },
      { name: MEDICINE_EXPIRY_QUEUE },
      { name: NOTIFICATIONS_QUEUE },
      { name: PDF_GENERATION_QUEUE },
    ),
  ],
  providers: [
    AppointmentReminderProducer,
    AppointmentReminderProcessor,
    MedicineExpiryProducer,
    MedicineExpiryProcessor,
    NotificationProcessor,
    PdfGenerationProcessor,
    JobsService,
  ],
  exports: [JobsService, BullModule],
})
export class JobsModule {}
