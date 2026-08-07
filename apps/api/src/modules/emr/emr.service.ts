import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class EMRService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getMedicalRecords(user: any, filterPatientId?: string, filterHospitalId?: string) {
    const where: any = {};

    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (patient) {
        where.patientId = patient.id;
      }
    } else if (filterPatientId) {
      where.patientId = filterPatientId;
    }

    if (filterHospitalId) {
      where.hospitalId = filterHospitalId;
    } else if (user.role !== 'SUPER_ADMIN' && user.hospitalId) {
      where.hospitalId = user.hospitalId;
    }

    return this.prisma.medicalRecord.findMany({
      where,
      include: {
        patient: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        doctor: { select: { id: true, specialisation: true, user: { select: { firstName: true, lastName: true } } } },
        appointment: true,
        prescriptions: { include: { items: { include: { medicine: true } } } },
        labOrders: { include: { results: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMedicalRecordById(id: string, user: any) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true, department: true } },
        appointment: true,
        prescriptions: { include: { items: { include: { medicine: true } } } },
        labOrders: { include: { results: true } },
      },
    });

    if (!record) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medical record not found' },
      });
    }

    if (user.role === 'PATIENT' && record.patient.userId !== user.id) {
      throw new NotFoundException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied to this clinical record' },
      });
    }

    return record;
  }

  async createMedicalRecord(user: any, body: any, ipAddress?: string) {
    const { appointmentId, patientId, vitals, chiefComplaint, diagnosis, treatmentPlan, allergies, vaccinations, familyHistory, attachments } = body;

    const doctorProfile = await this.prisma.doctor.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    const doctorId = doctorProfile ? doctorProfile.id : body.doctorId;
    const hospitalId = doctorProfile?.user.hospitalId || user.hospitalId;

    const record = await this.prisma.medicalRecord.create({
      data: {
        appointmentId,
        patientId,
        doctorId,
        hospitalId,
        vitals: typeof vitals === 'object' ? JSON.stringify(vitals) : vitals,
        chiefComplaint,
        diagnosis,
        treatmentPlan,
        allergies: allergies || null,
        vaccinations: vaccinations || null,
        familyHistory: familyHistory || null,
        attachments: attachments ? JSON.stringify(attachments) : null,
      },
      include: {
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' },
    });

    await this.auditService.createAuditLog(
      user.id,
      hospitalId,
      'CREATE',
      'MedicalRecord',
      record.id,
      `Created clinical EMR record for diagnosis: ${diagnosis}`,
      ipAddress,
    );

    return record;
  }
}
