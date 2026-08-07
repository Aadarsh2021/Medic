import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardData(user: any, filterHospitalId?: string) {
    const targetHospitalId = filterHospitalId || user.hospitalId;

    const [totalPatients, totalDoctors, totalAppointments, paidInvoices, rooms, labOrders] = await Promise.all([
      this.prisma.patient.count({ where: targetHospitalId && user.role !== 'SUPER_ADMIN' ? { hospitalId: targetHospitalId } : {} }),
      this.prisma.doctor.count({ where: targetHospitalId && user.role !== 'SUPER_ADMIN' ? { user: { hospitalId: targetHospitalId } } : {} }),
      this.prisma.appointment.count({ where: targetHospitalId && user.role !== 'SUPER_ADMIN' ? { hospitalId: targetHospitalId } : {} }),
      this.prisma.invoice.findMany({
        where: {
          ...(targetHospitalId && user.role !== 'SUPER_ADMIN' ? { hospitalId: targetHospitalId } : {}),
          status: 'PAID',
        },
        select: { total: true },
      }),
      this.prisma.room.findMany({ where: targetHospitalId && user.role !== 'SUPER_ADMIN' ? { hospitalId: targetHospitalId } : {} }),
      this.prisma.labOrder.count({ where: targetHospitalId && user.role !== 'SUPER_ADMIN' ? { hospitalId: targetHospitalId } : {} }),
    ]);

    const totalRevenue = paidInvoices.reduce((acc: number, inv: { total: any }) => acc + Number(inv.total), 0);
    const occupiedBeds = rooms.filter((r: { status: string }) => r.status === 'OCCUPIED').length;
    const totalBeds = rooms.length || 50;

    const appointmentChartData = [
      { day: 'Mon', appointments: 24, revenue: 1450 },
      { day: 'Tue', appointments: 32, revenue: 2100 },
      { day: 'Wed', appointments: 28, revenue: 1850 },
      { day: 'Thu', appointments: 40, revenue: 2900 },
      { day: 'Fri', appointments: 38, revenue: 2750 },
      { day: 'Sat', appointments: 20, revenue: 1200 },
      { day: 'Sun', appointments: 15, revenue: 950 },
    ];

    const departmentOccupancy = [
      { name: 'Cardiology', activeDoctors: 4, occupancyRate: 85 },
      { name: 'Neurology', activeDoctors: 3, occupancyRate: 70 },
      { name: 'Orthopedics', activeDoctors: 5, occupancyRate: 92 },
      { name: 'Pediatrics', activeDoctors: 4, occupancyRate: 60 },
      { name: 'General Medicine', activeDoctors: 8, occupancyRate: 88 },
    ];

    return {
      kpis: {
        totalPatients,
        totalDoctors,
        totalAppointments,
        totalRevenue,
        occupiedBeds,
        totalBeds,
        pendingLabOrders: labOrders,
      },
      appointmentChartData,
      departmentOccupancy,
    };
  }

  async getRevenueData(user: any, from?: string, to?: string, filterHospitalId?: string) {
    const targetHospitalId = filterHospitalId || user.hospitalId;

    const where: any = {
      status: 'PAID',
    };

    if (targetHospitalId && user.role !== 'SUPER_ADMIN') {
      where.hospitalId = targetHospitalId;
    }

    if (from || to) {
      where.paidAt = {};
      if (from) where.paidAt.gte = new Date(from);
      if (to) where.paidAt.lte = new Date(to);
    }

    const paidInvoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: true,
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { paidAt: 'desc' },
    });

    const formattedInvoices = paidInvoices.map((inv) => ({
      ...inv,
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax),
      discount: Number(inv.discount),
      total: Number(inv.total),
    }));

    const totalRevenue = formattedInvoices.reduce((acc, inv) => acc + inv.total, 0);

    const breakdownByDepartment = paidInvoices.reduce((acc: any, inv) => {
      inv.items.forEach((item) => {
        const dept = item.department || 'Consultation';
        acc[dept] = (acc[dept] || 0) + Number(item.totalAmount);
      });
      return acc;
    }, {});

    return {
      totalRevenue,
      invoicesCount: paidInvoices.length,
      breakdownByDepartment,
      invoices: formattedInvoices,
    };
  }
}
