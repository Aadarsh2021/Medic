import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { EMRModule } from './modules/emr/emr.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module';
import { LabModule } from './modules/lab/lab.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

import { RedisModule } from './redis/redis.module';
import { JobsModule } from './jobs/jobs.module';
import { StorageModule } from './storage/storage.module';
import { PdfModule } from './pdf/pdf.module';
import { ProvidersModule } from './providers/providers.module';

import { DiscoveryModule } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DiscoveryModule,
    PrismaModule,
    RedisModule,
    ProvidersModule,
    JobsModule,
    // StorageModule,
    // PdfModule,
    AuditModule,
    AuthModule,
    UsersModule,
    HospitalsModule,
    AppointmentsModule,
    EMRModule,
    PrescriptionsModule,
    PharmacyModule,
    LabModule,
    BillingModule,
    NotificationsModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
