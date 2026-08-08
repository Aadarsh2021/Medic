import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HospitalsService } from './hospitals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('hospitals')
@Controller('hospitals')
export class HospitalsController {
  constructor(private hospitalsService: HospitalsService) {}

  @Get('public')
  @ApiOperation({ summary: 'Get public hospital list for staff registration dropdowns' })
  async getPublicHospitals() {
    const data = await this.hospitalsService.getPublicHospitals();
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @ApiOperation({ summary: 'Get accessible hospital tenants' })
  async getHospitals(@CurrentUser() user: any) {
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const data = await this.hospitalsService.getHospitals(user.hospitalId, isSuperAdmin);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Register a new hospital branch' })
  async createHospital(@Body() body: any) {
    const data = await this.hospitalsService.createHospital(body);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/departments')
  @ApiOperation({ summary: 'List departments for hospital' })
  async getDepartments(@Param('id') id: string) {
    const data = await this.hospitalsService.getDepartments(id);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/departments')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN')
  @ApiOperation({ summary: 'Create department under hospital' })
  async createDepartment(@Param('id') id: string, @Body() body: { name: string; code: string }) {
    const data = await this.hospitalsService.createDepartment(id, body.name, body.code);
    return { success: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/rooms')
  @ApiOperation({ summary: 'List rooms for hospital' })
  async getRooms(@Param('id') id: string) {
    const data = await this.hospitalsService.getRooms(id);
    return { success: true, data };
  }
}
