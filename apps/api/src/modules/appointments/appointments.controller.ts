import { Controller, Get, Post, Patch, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('appointments')
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  @Get('slots')
  @ApiOperation({ summary: 'Get doctor slot availability for date' })
  async getSlots(@Query('doctorId') doctorId: string, @Query('date') date: string) {
    const data = await this.appointmentsService.getAvailableSlots(doctorId, date);
    return { success: true, data };
  }

  @Get()
  @ApiOperation({ summary: 'List appointments' })
  async getAppointments(
    @CurrentUser() user: any,
    @Query('hospitalId') hospitalId?: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.appointmentsService.getAppointments(user, hospitalId, patientId, status);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Book an appointment' })
  async createAppointment(@CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.appointmentsService.createAppointment(user, body, req.ip);
    return { success: true, data, message: 'Appointment booked successfully' };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update appointment status' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any, @Req() req: Request) {
    const data = await this.appointmentsService.updateAppointmentStatus(id, status, user, req.ip);
    return { success: true, data, message: `Appointment status updated to ${status}` };
  }
}
