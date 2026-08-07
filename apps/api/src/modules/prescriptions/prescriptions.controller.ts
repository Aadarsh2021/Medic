import { Controller, Get, Post, Query, Body, Param, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('prescriptions')
@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private prescriptionsService: PrescriptionsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List prescriptions' })
  async getPrescriptions(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('hospitalId') hospitalId?: string,
  ) {
    const data = await this.prescriptionsService.getPrescriptions(user, patientId, hospitalId);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('DOCTOR', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Issue a new prescription' })
  async createPrescription(@CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.prescriptionsService.createPrescription(user, body, req.ip);
    return { success: true, data, message: 'Prescription issued successfully' };
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generate printable PDF HTML Rx receipt' })
  async getPdfHtml(@Param('id') id: string, @Res() res: Response) {
    const html = await this.prescriptionsService.generatePrescriptionPdfHtml(id);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }
}
