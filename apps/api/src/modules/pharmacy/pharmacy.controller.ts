import { Controller, Get, Post, Query, Body, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('pharmacy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('medicines')
export class PharmacyController {
  constructor(private pharmacyService: PharmacyService) {}

  @Get()
  @ApiOperation({ summary: 'Get medicine inventory list with total stock' })
  async getMedicines(@CurrentUser() user: any, @Query('hospitalId') hospitalId?: string) {
    const data = await this.pharmacyService.getMedicines(user, hospitalId);
    return { success: true, data };
  }

  @Get('expiring-soon')
  @Roles('PHARMACIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get batches expiring within 30 days' })
  async getExpiringSoon(@CurrentUser() user: any, @Query('hospitalId') hospitalId?: string) {
    const data = await this.pharmacyService.getExpiringSoon(user, hospitalId);
    return { success: true, data };
  }

  @Post()
  @Roles('PHARMACIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Add new medicine item to pharmacy inventory' })
  async createMedicine(@CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.pharmacyService.createMedicine(user, body, req.ip);
    return { success: true, data, message: 'Medicine created successfully' };
  }

  @Post(':id/batches')
  @Roles('PHARMACIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Add batch to medicine stock' })
  async addBatch(@Param('id') id: string, @CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.pharmacyService.addBatch(user, id, body, req.ip);
    return { success: true, data, message: 'Batch added successfully' };
  }

  @Post('dispense')
  @Roles('PHARMACIST', 'HOSPITAL_ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Dispense medicine using FIFO strategy & expiry protection' })
  async dispenseMedicine(@CurrentUser() user: any, @Body() body: any, @Req() req: Request) {
    const data = await this.pharmacyService.dispenseMedicine(user, body, req.ip);
    return { success: true, data, message: 'Medicine dispensed successfully' };
  }
}
