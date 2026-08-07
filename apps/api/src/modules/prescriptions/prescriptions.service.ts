import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PrescriptionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getPrescriptions(user: any, filterPatientId?: string, filterHospitalId?: string) {
    const where: any = {};

    if (user.role === 'PATIENT') {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (patient) where.patientId = patient.id;
    } else if (filterPatientId) {
      where.patientId = filterPatientId;
    }

    if (filterHospitalId) {
      where.hospitalId = filterHospitalId;
    } else if (user.role !== 'SUPER_ADMIN' && user.hospitalId) {
      where.hospitalId = user.hospitalId;
    }

    return this.prisma.prescription.findMany({
      where,
      include: {
        items: { include: { medicine: true } },
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
        doctor: { select: { id: true, specialisation: true, user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPrescription(user: any, body: any, ipAddress?: string) {
    const { medicalRecordId, patientId, items, notes } = body;

    const doctorProfile = await this.prisma.doctor.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });

    const doctorId = doctorProfile ? doctorProfile.id : body.doctorId;
    const hospitalId = doctorProfile?.user.hospitalId || user.hospitalId;

    const prescription = await this.prisma.prescription.create({
      data: {
        medicalRecordId,
        doctorId,
        patientId,
        hospitalId,
        notes: notes || null,
        doctorSignature: doctorProfile?.digitalSignature || null,
        items: {
          create: items.map((item: any) => ({
            medicineId: item.medicineId,
            form: item.form || 'Tablet',
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: Number(item.durationDays || 5),
            instructions: item.instructions || null,
          })),
        },
      },
      include: {
        items: { include: { medicine: true } },
        patient: { include: { user: true } },
        doctor: { include: { user: true } },
      },
    });

    await this.auditService.createAuditLog(
      user.id,
      hospitalId,
      'CREATE',
      'Prescription',
      prescription.id,
      `Issued prescription with ${items.length} items`,
      ipAddress,
    );

    return prescription;
  }

  async generatePrescriptionPdfHtml(id: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        hospital: true,
        patient: { include: { user: true } },
        doctor: { include: { user: true, department: true } },
        items: { include: { medicine: true } },
      },
    });

    if (!prescription) {
      throw new NotFoundException('Prescription record not found');
    }

    const itemsRows = prescription.items
      .map(
        (item, index) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${index + 1}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;"><strong>${item.medicine.name}</strong> (${item.form})</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.dosage}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.frequency}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.durationDays} days</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.instructions || '-'}</td>
      </tr>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Prescription Rx - ${prescription.id.slice(-6)}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1e293b; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
          .title { font-size: 24px; font-weight: bold; color: #1e40af; }
          .meta { font-size: 14px; color: #64748b; margin-top: 5px; }
          .rx-symbol { font-size: 36px; font-weight: bold; color: #2563eb; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 14px; color: #475569; }
          .footer { margin-top: 50px; border-top: 1px solid #cbd5e1; padding-top: 20px; display: flex; justify-content: space-between; }
          .signature-box { text-align: right; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${prescription.hospital.name}</div>
            <div class="meta">${prescription.hospital.address} | Tel: ${prescription.hospital.phone}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: bold;">PRESCRIPTION</div>
            <div class="meta">Date: ${new Date(prescription.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 30px; background: #f8fafc; padding: 15px; border-radius: 8px;">
          <div>
            <strong>Patient Name:</strong> ${prescription.patient.user.firstName} ${prescription.patient.user.lastName}<br>
            <strong>MRN:</strong> ${prescription.patient.mrn} | <strong>Gender/DOB:</strong> ${prescription.patient.gender} (${prescription.patient.dob})
          </div>
          <div>
            <strong>Doctor Name:</strong> Dr. ${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}<br>
            <strong>License:</strong> ${prescription.doctor.licenseNumber} | <strong>Dept:</strong> ${prescription.doctor.specialisation}
          </div>
        </div>

        <div class="rx-symbol">Rx</div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Medicine</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        ${prescription.notes ? `<div style="margin-top: 25px; background: #fffbeb; padding: 12px; border-left: 4px solid #f59e0b;"><strong>Doctor Notes:</strong> ${prescription.notes}</div>` : ''}

        <div class="footer">
          <div style="font-size: 12px; color: #94a3b8;">
            Generates via MedCore HMS Cloud Platform.<br>Valid only with digital doctor authorization signature.
          </div>
          <div class="signature-box">
            ${prescription.doctorSignature ? `<img src="${prescription.doctorSignature}" height="40"/><br>` : ''}
            <strong>Dr. ${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}</strong><br>
            <span style="font-size: 12px; color: #64748b;">Digital Signature Verified</span>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
