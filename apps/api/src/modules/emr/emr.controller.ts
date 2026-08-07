import { Controller, Get, Post, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { EMRService } from './emr.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('emr')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emr')
export class EMRController {
  constructor(private emrService: EMRService) {}

  @Get()
  @ApiOperation({ summary: 'List medical records' })
  async getRecords(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('hospitalId') hospitalId?: string,
  ) {
    const data = await this.emrService.getMedicalRecords(user, patientId, hospitalId);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific medical record by ID' })
  async getRecordById(@Param('id') id: string, @CurrentUser() user: any) {
    const data = await this.emrService.getMedicalRecordById(id, user);
    return { success: true, data };
  }

  @Post()
  @Roles('DOCTOR', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create new EMR clinical encounter record' })
  async createRecord(@CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.emrService.createMedicalRecord(user, body, req.ip);
    return { success: true, data, message: 'EMR record created successfully' };
  }
}
