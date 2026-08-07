import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUsers(hospitalId?: string, isSuperAdmin = false) {
    const where: any = {};
    if (hospitalId && !isSuperAdmin) {
      where.hospitalId = hospitalId;
    }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        hospitalId: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDoctors(hospitalId?: string, isSuperAdmin = false) {
    const where: any = {};
    if (hospitalId && !isSuperAdmin) {
      where.user = { hospitalId };
    }
    return this.prisma.doctor.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true, hospitalId: true } },
        department: true,
      },
    });
  }

  async getPatients(hospitalId?: string, isSuperAdmin = false) {
    const where: any = {};
    if (hospitalId && !isSuperAdmin) {
      where.hospitalId = hospitalId;
    }
    return this.prisma.patient.findMany({
      where,
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: { mrn: 'asc' },
    });
  }
}
