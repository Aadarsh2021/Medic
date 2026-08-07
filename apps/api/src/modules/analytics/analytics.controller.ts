import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get main operational analytics KPIs' })
  async getDashboard(@CurrentUser() user: any, @Query('hospitalId') hospitalId?: string) {
    const data = await this.analyticsService.getDashboardData(user, hospitalId);
    return { success: true, data };
  }

  @Get('revenue')
  @Roles('HOSPITAL_ADMIN', 'ACCOUNTANT', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get revenue analytics and departmental breakdown' })
  async getRevenue(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('hospitalId') hospitalId?: string,
  ) {
    const data = await this.analyticsService.getRevenueData(user, from, to, hospitalId);
    return { success: true, data };
  }
}
