import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Job } from 'bullmq';
import { PrescriptionPdfGenerator } from '../../pdf/pdf-prescription.generator';
import { InvoicePdfGenerator } from '../../pdf/pdf-invoice.generator';

export const PDF_GENERATION_QUEUE = 'pdf-generation';

export interface PdfGenerationPayload {
  documentId: string;
  hospitalId: string;
  type: 'INVOICE' | 'PRESCRIPTION';
}

@Processor(PDF_GENERATION_QUEUE)
export class PdfGenerationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PdfGenerationProcessor.name);
  private prescriptionPdfGenerator: PrescriptionPdfGenerator;
  private invoicePdfGenerator: InvoicePdfGenerator;

  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  onModuleInit() {
    this.prescriptionPdfGenerator = this.moduleRef.get(PrescriptionPdfGenerator, { strict: false });
    this.invoicePdfGenerator = this.moduleRef.get(InvoicePdfGenerator, { strict: false });
  }

  async process(job: Job<PdfGenerationPayload>): Promise<any> {
    const { documentId, hospitalId, type } = job.data;
    this.logger.log(`Processing BullMQ PDF Generation job: type=${type}, id=${documentId}, hospital=${hospitalId}`);

    if (type === 'PRESCRIPTION') {
      const result = await this.prescriptionPdfGenerator.generatePrescriptionPdf(documentId, hospitalId);
      return { success: true, type, storageKey: result.storageKey, size: result.buffer.length };
    }

    if (type === 'INVOICE') {
      const result = await this.invoicePdfGenerator.generateInvoicePdf(documentId, hospitalId);
      return { success: true, type, storageKey: result.storageKey, size: result.buffer.length };
    }

    throw new Error(`Unsupported PDF generation job type: ${type}`);
  }
}
