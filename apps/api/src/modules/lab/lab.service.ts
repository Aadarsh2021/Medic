import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LabService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getLabOrders(user: any, filterPatientId?: string, filterHospitalId?: string, status?: string) {
    const where: any = {};

    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (patient) where.patientId = patient.id;
    } else if (filterPatientId) {
      where.patientId = filterPatientId;
    }

    if (status) where.status = status;

    if (filterHospitalId) {
      where.hospitalId = filterHospitalId;
    } else if (user.role !== 'SUPER_ADMIN' && user.hospitalId) {
      where.hospitalId = user.hospitalId;
    }

    return this.prisma.labOrder.findMany({
      where,
      include: {
        results: true,
        patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        doctor: { select: { id: true, specialisation: true, user: { select: { firstName: true, lastName: true } } } },
        medicalRecord: { select: { diagnosis: true, vitals: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLabOrder(user: any, body: any, ipAddress?: string) {
    const { medicalRecordId, patientId, testName, category } = body;

    const doctorProfile = await this.prisma.doctor.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    const doctorId = doctorProfile ? doctorProfile.id : body.doctorId;
    const hospitalId = doctorProfile?.user.hospitalId || user.hospitalId;

    const order = await this.prisma.labOrder.create({
      data: {
        medicalRecordId,
        patientId,
        doctorId,
        hospitalId,
        testName,
        category: category || 'Biochemistry',
        status: 'ORDERED',
      },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    await this.auditService.createAuditLog(
      user.id,
      hospitalId,
      'CREATE',
      'LabOrder',
      order.id,
      `Ordered lab test ${testName} (${category})`,
      ipAddress,
    );

    return order;
  }

  async collectSample(id: string, user: any, ipAddress?: string) {
    const order = await this.prisma.labOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lab order not found' },
      });
    }

    if (order.status !== 'ORDERED') {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_STATE', message: `Cannot collect sample. Order status is ${order.status}` },
      });
    }

    const updated = await this.prisma.labOrder.update({
      where: { id },
      data: {
        status: 'SAMPLE_COLLECTED',
        sampleCollectedAt: new Date(),
      },
    });

    await this.auditService.createAuditLog(
      user.id,
      order.hospitalId,
      'UPDATE',
      'LabOrder',
      order.id,
      `Sample collected for lab order ${order.testName}`,
      ipAddress,
    );

    return updated;
  }

  async uploadResult(id: string, body: any, user: any, ipAddress?: string) {
    const { refRangeMin, refRangeMax, unit, resultValue, technicianNotes, reportUrl } = body;

    const order = await this.prisma.labOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lab order not found' },
      });
    }

    if (order.status !== 'SAMPLE_COLLECTED') {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_STATE', message: `Cannot upload result. Order must be in SAMPLE_COLLECTED state but is ${order.status}` },
      });
    }

    const val = Number(resultValue);
    const min = Number(refRangeMin);
    const max = Number(refRangeMax);
    const isOutOfRange = val < min || val > max;

    const result = await this.prisma.labResult.create({
      data: {
        labOrderId: id,
        refRangeMin: min,
        refRangeMax: max,
        unit,
        resultValue: val,
        isOutOfRange,
        technicianNotes: technicianNotes || null,
        reportUrl: reportUrl || null,
      },
    });

    const updatedOrder = await this.prisma.labOrder.update({
      where: { id },
      data: { status: 'RESULT_UPLOADED' },
      include: { results: true },
    });

    await this.auditService.createAuditLog(
      user.id,
      order.hospitalId,
      'CREATE',
      'LabResult',
      result.id,
      `Uploaded test result for ${order.testName}: ${val} ${unit} (Out of range: ${isOutOfRange})`,
      ipAddress,
    );

    return updatedOrder;
  }

  async approveResult(id: string, body: { status: string; approvedBy?: string }, user: any, ipAddress?: string) {
    const { status, approvedBy } = body;
    const order = await this.prisma.labOrder.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lab order not found' },
      });
    }

    if (order.status !== 'RESULT_UPLOADED') {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_STATE', message: `Cannot approve result. Order must be in RESULT_UPLOADED state but is ${order.status}` },
      });
    }

    const nextStatus = status === 'REJECTED' ? 'REJECTED' : 'APPROVED';

    const updated = await this.prisma.labOrder.update({
      where: { id },
      data: {
        status: nextStatus,
        approvedBy: approvedBy || `${user.firstName} ${user.lastName}`,
      },
      include: { results: true },
    });

    await this.auditService.createAuditLog(
      user.id,
      order.hospitalId,
      'UPDATE',
      'LabOrder',
      order.id,
      `Lab order ${order.testName} ${nextStatus} by ${user.firstName} ${user.lastName}`,
      ipAddress,
    );

    return updated;
  }
}
