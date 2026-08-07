import { Controller, Get, Post, Query, Body, Param, Req, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('billing')
@Controller('invoices')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'List invoices' })
  async getInvoices(
    @CurrentUser() user: any,
    @Query('patientId') patientId?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.billingService.getInvoices(user, patientId, hospitalId, status);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generate HTML invoice receipt (authenticated, hospital-scoped)' })
  async getPdfHtml(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    // Fetch invoice with authorization enforcement
    const invoice = await this.billingService.getInvoiceById(id, user);
    const html = await this.billingService.generateInvoicePdfHtml(id);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('ACCOUNTANT', 'RECEPTIONIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Generate new draft/final invoice' })
  async createInvoice(@CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.billingService.createInvoice(user, body, req.ip);
    return { success: true, data, message: 'Invoice generated successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/pay')
  @ApiOperation({ summary: 'Record payment for invoice' })
  async payInvoice(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const data = await this.billingService.payInvoice(id, body, user, req.ip);
    return { success: true, data, message: 'Payment recorded successfully' };
  }

  @Post('payments/webhook/stripe')
  @ApiOperation({ summary: 'Stripe payment webhook listener' })
  async stripeWebhook(@Body() body: any) {
    return { received: true };
  }
}
