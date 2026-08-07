import { Controller, Get, Post, Query, Body, Param, Req, Res, Headers, UseGuards, RawBodyRequest } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Record manual payment for invoice' })
  async payInvoice(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any, @Req() req: Request) {
    const data = await this.billingService.payInvoice(id, body, user, req.ip);
    return { success: true, data, message: 'Payment recorded successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/stripe-intent')
  @ApiOperation({ summary: 'Create Stripe PaymentIntent with server-authoritative amount' })
  async createStripeIntent(@Param('id') id: string, @CurrentUser() user: any) {
    return this.billingService.createStripePaymentIntent(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/razorpay-order')
  @ApiOperation({ summary: 'Create Razorpay Order with server-authoritative amount in paise' })
  async createRazorpayOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.billingService.createRazorpayOrder(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('razorpay-verify')
  @ApiOperation({ summary: 'Verify Razorpay checkout signature and confirm payment' })
  async verifyRazorpayCheckout(@CurrentUser() user: any, @Body() body: any) {
    return this.billingService.verifyRazorpayCheckout(user, body);
  }

  @Post('webhooks/stripe')
  @ApiOperation({ summary: 'Raw body Stripe payment webhook listener with cryptographic signature verification' })
  async stripeWebhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    const rawBody = req.rawBody || (req.body ? JSON.stringify(req.body) : '');
    return this.billingService.handleStripeWebhook(rawBody, signature || '');
  }

  @Post('webhooks/razorpay')
  @ApiOperation({ summary: 'Raw body Razorpay webhook listener with HMAC signature verification' })
  async razorpayWebhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string) {
    const rawBody = req.rawBody || (req.body ? JSON.stringify(req.body) : '');
    return this.billingService.handleRazorpayWebhook(rawBody, signature || '');
  }
}
