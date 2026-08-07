import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private gateway: NotificationsGateway,
  ) {}

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Notification not found' },
      });
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async sendNotification(userId: string, hospitalId: string, title: string, message: string, link?: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        hospitalId,
        title,
        message,
        link: link || null,
        channel: 'IN_APP',
      },
    });

    this.gateway.sendNotificationToUser(userId, notification);
    return notification;
  }
}
