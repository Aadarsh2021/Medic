import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List all users scoped by tenant' })
  async getUsers(@Query('hospitalId') queryHospitalId: string, @CurrentUser() user: any) {
    const targetHospitalId = queryHospitalId || user.hospitalId;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const data = await this.usersService.getUsers(targetHospitalId, isSuperAdmin);
    return { success: true, data };
  }

  @Get('doctors')
  @ApiOperation({ summary: 'List doctors' })
  async getDoctors(@Query('hospitalId') queryHospitalId: string, @CurrentUser() user: any) {
    const targetHospitalId = queryHospitalId || user.hospitalId;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const data = await this.usersService.getDoctors(targetHospitalId, isSuperAdmin);
    return { success: true, data };
  }

  @Get('patients')
  @ApiOperation({ summary: 'List patients' })
  async getPatients(@Query('hospitalId') queryHospitalId: string, @CurrentUser() user: any) {
    const targetHospitalId = queryHospitalId || user.hospitalId;
    const isSuperAdmin = user.role === 'SUPER_ADMIN';
    const data = await this.usersService.getPatients(targetHospitalId, isSuperAdmin);
    return { success: true, data };
  }
}
