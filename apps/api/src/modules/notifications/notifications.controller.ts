import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('notifications')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user notifications' })
  async getMyNotifications(@CurrentUser('id') userId: string) {
    const data = await this.notificationsService.getUserNotifications(userId);
    return { success: true, data };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const data = await this.notificationsService.markAsRead(id, userId);
    return { success: true, data };
  }
}
