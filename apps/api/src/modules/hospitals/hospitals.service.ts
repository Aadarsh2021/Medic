import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService) {}

  async getPublicHospitals() {
    return this.prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
  }

  async getHospitals(userHospitalId?: string, isSuperAdmin = false) {
    const where: any = {};
    if (userHospitalId && !isSuperAdmin) {
      where.id = userHospitalId;
    }
    return this.prisma.hospital.findMany({
      where,
      include: { departments: true },
    });
  }

  async createHospital(data: { name: string; code: string; address: string; phone: string; email: string }) {
    return this.prisma.hospital.create({ data });
  }

  async getDepartments(hospitalId: string) {
    return this.prisma.department.findMany({ where: { hospitalId } });
  }

  async createDepartment(hospitalId: string, name: string, code: string) {
    return this.prisma.department.create({
      data: { hospitalId, name, code },
    });
  }

  async getRooms(hospitalId: string) {
    return this.prisma.room.findMany({ where: { hospitalId } });
  }
}
