import { Controller, Get, Post, Patch, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LabService } from './lab.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('lab')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lab-orders')
export class LabController {
  constructor(private labService: LabService) {}

  @Get()
  @ApiOperation({ summary: 'List lab orders' })
  async getLabOrders(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.labService.getLabOrders(user, patientId, hospitalId, status);
    return { success: true, data };
  }

  @Post()
  @Roles('DOCTOR', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Order a diagnostic lab test' })
  async createLabOrder(@CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.labService.createLabOrder(user, body, req.ip);
    return { success: true, data, message: 'Lab order created successfully' };
  }

  @Patch(':id/collect')
  @Roles('LAB_TECHNICIAN', 'RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Mark sample collected for lab order' })
  async collectSample(@Param('id') id: string, @CurrentUser() user: any, @Req() req: Request) {
    const data = await this.labService.collectSample(id, user, req.ip);
    return { success: true, data, message: 'Sample collected successfully' };
  }

  @Patch(':id/result')
  @Roles('LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Upload lab test result values and reference ranges' })
  async uploadResult(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const data = await this.labService.uploadResult(id, body, user, req.ip);
    return { success: true, data, message: 'Lab result uploaded successfully' };
  }

  @Patch(':id/approve')
  @Roles('LAB_TECHNICIAN', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR')
  @ApiOperation({ summary: 'Approve or reject lab test result' })
  async approveResult(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const data = await this.labService.approveResult(id, body, user, req.ip);
    return { success: true, data, message: `Lab result ${body.status || 'APPROVED'} successfully` };
  }
}
