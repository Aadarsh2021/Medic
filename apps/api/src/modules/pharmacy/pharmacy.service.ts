import { Injectable, UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PharmacyService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getMedicines(user: any, filterHospitalId?: string) {
    const targetHospitalId = filterHospitalId || user.hospitalId;
    const where: any = {};
    if (targetHospitalId && user.role !== 'SUPER_ADMIN') {
      where.hospitalId = targetHospitalId;
    }

    const medicines = await this.prisma.medicine.findMany({
      where,
      include: {
        batches: { orderBy: { expiryDate: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    return medicines.map((m) => {
      const activeBatches = m.batches.filter((b) => !b.isQuarantined && new Date(b.expiryDate) > new Date());
      const totalStock = activeBatches.reduce((acc, b) => acc + b.quantity, 0);
      return {
        ...m,
        unitCost: Number(m.unitCost),
        mrp: Number(m.mrp),
        batches: m.batches.map((b) => ({
          ...b,
          unitCost: Number(b.unitCost),
          mrp: Number(b.mrp),
        })),
        totalStock,
        isLowStock: totalStock <= m.reorderLevel,
      };
    });
  }

  async getExpiringSoon(user: any, filterHospitalId?: string) {
    const targetHospitalId = filterHospitalId || user.hospitalId;
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    const where: any = {
      expiryDate: { lte: thirtyDaysStr },
    };

    if (targetHospitalId && user.role !== 'SUPER_ADMIN') {
      where.medicine = { hospitalId: targetHospitalId };
    }

    const batches = await this.prisma.medicineBatch.findMany({
      where,
      include: { medicine: true },
      orderBy: { expiryDate: 'asc' },
    });

    return batches.map((b) => ({
      ...b,
      unitCost: Number(b.unitCost),
      mrp: Number(b.mrp),
      medicine: {
        ...b.medicine,
        unitCost: Number(b.medicine.unitCost),
        mrp: Number(b.medicine.mrp),
      },
    }));
  }

  async createMedicine(user: any, body: any, ipAddress?: string) {
    const { name, category, form, reorderLevel, unitCost, mrp, initialBatch, hospitalId } = body;
    const targetHospitalId = hospitalId || user.hospitalId;

    const medicine = await this.prisma.medicine.create({
      data: {
        hospitalId: targetHospitalId,
        name,
        category,
        form,
        reorderLevel: Number(reorderLevel || 20),
        unitCost: Number(unitCost),
        mrp: Number(mrp),
        ...(initialBatch
          ? {
              batches: {
                create: {
                  batchNumber: initialBatch.batchNumber,
                  mfgDate: initialBatch.mfgDate,
                  expiryDate: initialBatch.expiryDate,
                  quantity: Number(initialBatch.quantity),
                  unitCost: Number(initialBatch.unitCost || unitCost),
                  mrp: Number(initialBatch.mrp || mrp),
                },
              },
            }
          : {}),
      },
      include: { batches: true },
    });

    await this.auditService.createAuditLog(
      user.id,
      targetHospitalId,
      'CREATE',
      'Medicine',
      medicine.id,
      `Added new medicine ${name} (${form})`,
      ipAddress,
    );

    return {
      ...medicine,
      unitCost: Number(medicine.unitCost),
      mrp: Number(medicine.mrp),
    };
  }

  async addBatch(user: any, medicineId: string, body: any, ipAddress?: string) {
    const { batchNumber, mfgDate, expiryDate, quantity, unitCost, mrp } = body;

    const medicine = await this.prisma.medicine.findUnique({ where: { id: medicineId } });
    if (!medicine) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medicine not found' },
      });
    }

    const batch = await this.prisma.medicineBatch.create({
      data: {
        medicineId,
        batchNumber,
        mfgDate,
        expiryDate,
        quantity: Number(quantity),
        unitCost: Number(unitCost || medicine.unitCost),
        mrp: Number(mrp || medicine.mrp),
      },
    });

    await this.auditService.createAuditLog(
      user.id,
      medicine.hospitalId,
      'CREATE',
      'MedicineBatch',
      batch.id,
      `Added batch ${batchNumber} with quantity ${quantity}`,
      ipAddress,
    );

    return {
      ...batch,
      unitCost: Number(batch.unitCost),
      mrp: Number(batch.mrp),
    };
  }

  async dispenseMedicine(user: any, body: { medicineId: string; quantityToDispense: number }, ipAddress?: string) {
    const { medicineId, quantityToDispense } = body;
    const reqQty = Number(quantityToDispense);

    const medicine = await this.prisma.medicine.findUnique({
      where: { id: medicineId },
      include: { batches: { orderBy: { expiryDate: 'asc' } } },
    });

    if (!medicine) {
      throw new NotFoundException({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Medicine item not found' },
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Filter valid unexpired, non-quarantined batches
    const validBatches = medicine.batches.filter((b) => !b.isQuarantined && b.expiryDate >= todayStr);
    const expiredBatches = medicine.batches.filter((b) => b.expiryDate < todayStr);

    const totalValidStock = validBatches.reduce((acc, b) => acc + b.quantity, 0);

    if (totalValidStock < reqQty) {
      const hasExpiredStock = expiredBatches.reduce((acc, b) => acc + b.quantity, 0) > 0;
      if (hasExpiredStock) {
        throw new UnprocessableEntityException({
          success: false,
          error: {
            code: 'EXPIRED_MEDICINE',
            message: 'Stock contains expired batches. Dispensing blocked by pharmacy safety rule.',
          },
        });
      }

      throw new UnprocessableEntityException({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Requested quantity (${reqQty}) exceeds available unexpired stock (${totalValidStock}).`,
        },
      });
    }

    // FIFO allocation strategy
    let remainingToDispense = reqQty;
    for (const batch of validBatches) {
      if (remainingToDispense <= 0) break;
      const deduct = Math.min(batch.quantity, remainingToDispense);
      remainingToDispense -= deduct;

      await this.prisma.medicineBatch.update({
        where: { id: batch.id },
        data: { quantity: batch.quantity - deduct },
      });
    }

    await this.auditService.createAuditLog(
      user.id,
      medicine.hospitalId,
      'UPDATE',
      'Medicine',
      medicine.id,
      `Dispensed ${reqQty} units of ${medicine.name} using FIFO batch allocation`,
      ipAddress,
    );

    return {
      medicineId,
      medicineName: medicine.name,
      dispensedQuantity: reqQty,
      remainingValidStock: totalValidStock - reqQty,
    };
  }
}
