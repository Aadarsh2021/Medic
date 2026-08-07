import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../../jobs/jobs.service';

// PRD-compliant appointment state machine
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private jobsService: JobsService,
  ) {}

  async getAvailableSlots(doctorId: string, date: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Doctor profile not found' },
      });
    }

    const allSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00'];

    const bookedAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: date,
        status: { notIn: ['CANCELLED'] },
        deletedAt: null,
      },
      select: { slotTime: true },
    });

    const bookedSlots = new Set(bookedAppointments.map((a) => a.slotTime));

    const slots = allSlots.map((time) => ({
      time,
      available: !bookedSlots.has(time),
    }));

    return { doctorId, date, slots };
  }

  async getAppointments(user: any, filterHospitalId?: string, filterPatientId?: string, status?: string) {
    const where: any = { deletedAt: null };

    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (patient) {
        where.patientId = patient.id;
      }
    } else if (user.role === 'DOCTOR') {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (doctor) {
        where.doctorId = doctor.id;
      }
    }

    if (filterPatientId) where.patientId = filterPatientId;
    if (status) where.status = status;

    if (filterHospitalId) {
      where.hospitalId = filterHospitalId;
    } else if (user.role !== 'SUPER_ADMIN' && user.hospitalId) {
      where.hospitalId = user.hospitalId;
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        patient: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } }, department: true } },
        department: true,
      },
      orderBy: [{ appointmentDate: 'asc' }, { slotTime: 'asc' }],
    });
  }

  async createAppointment(user: any, body: any, ipAddress?: string) {
    const { doctorId, appointmentDate, slotTime, reason, type, patientId: reqPatientId } = body;

    let targetPatientId = reqPatientId;
    if (user.role === 'PATIENT') {
      const p = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!p) {
        throw new NotFoundException({
          success: false,
          error: { code: 'PATIENT_NOT_FOUND', message: 'Patient profile not found for user' },
        });
      }
      targetPatientId = p.id;
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException({
        success: false,
        error: { code: 'DOCTOR_NOT_FOUND', message: 'Doctor not found' },
      });
    }

    const hospitalId = doctor.user.hospitalId || user.hospitalId;

    try {
      const appointment = await this.prisma.$transaction(async (tx) => {
        if (type !== 'EMERGENCY') {
          const existingSlot = await tx.appointment.findFirst({
            where: {
              doctorId,
              appointmentDate,
              slotTime,
              status: { notIn: ['CANCELLED'] },
              deletedAt: null,
            },
          });

          if (existingSlot) {
            throw new ConflictException({
              success: false,
              error: { code: 'SLOT_UNAVAILABLE', message: 'This slot is already booked. Please choose another time.' },
            });
          }
        }

        return tx.appointment.create({
          data: {
            hospitalId,
            patientId: targetPatientId,
            doctorId,
            departmentId: doctor.departmentId,
            appointmentDate,
            slotTime,
            status: 'PENDING',
            type: type || 'REGULAR',
            reason: reason || null,
          },
          include: {
            patient: { include: { user: { select: { firstName: true, lastName: true } } } },
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        });
      });

      await this.auditService.createAuditLog(
        user.id,
        hospitalId,
        'CREATE',
        'Appointment',
        appointment.id,
        `Booked appointment on ${appointmentDate} at ${slotTime}`,
        ipAddress,
      );

      try {
        const apptDateObj = new Date(`${appointmentDate}T${slotTime}:00`);
        await this.jobsService.scheduleAppointmentReminders(appointment.id, hospitalId, apptDateObj);
      } catch (err) {}

      return appointment;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException({
          success: false,
          error: { code: 'SLOT_UNAVAILABLE', message: 'This slot was just booked by another patient.' },
        });
      }
      throw error;
    }
  }

  async updateAppointmentStatus(id: string, status: string, user: any, ipAddress?: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });

    if (!appointment) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Appointment not found' },
      });
    }

    // Tenant isolation: non-SUPER_ADMIN users can only update their hospital's appointments
    if (user.role !== 'SUPER_ADMIN' && appointment.hospitalId !== user.hospitalId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot modify appointment from a different hospital' },
      });
    }

    // Enforce PRD lifecycle state machine
    const allowedNext = LEGAL_TRANSITIONS[appointment.status];
    if (!allowedNext) {
      throw new BadRequestException({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Unknown current status: ${appointment.status}` },
      });
    }

    if (!allowedNext.includes(status)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'ILLEGAL_TRANSITION',
          message: `Cannot transition appointment from ${appointment.status} to ${status}. Allowed: [${allowedNext.join(', ') || 'none'}]`,
        },
      });
    }

    const data: any = { status };
    if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data,
    });

    if (status === 'CANCELLED') {
      try {
        await this.jobsService.cancelAppointmentReminders(id);
      } catch (err) {}
    }

    await this.auditService.createAuditLog(
      user.id,
      appointment.hospitalId,
      'UPDATE',
      'Appointment',
      appointment.id,
      `Transitioned appointment status ${appointment.status} → ${status}`,
      ipAddress,
    );

    return updated;
  }
}
