import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async createAuditLog(
    userId: string | null,
    hospitalId: string | null,
    action: string,
    entityName: string,
    entityId?: string | null,
    details?: string | null,
    ipAddress?: string | null,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          hospitalId,
          action,
          entityName,
          entityId: entityId || null,
          details: details || null,
          ipAddress: ipAddress || null,
        },
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }
}
