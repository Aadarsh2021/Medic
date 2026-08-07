import { Module, Global } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PrescriptionPdfGenerator } from './pdf-prescription.generator';
import { InvoicePdfGenerator } from './pdf-invoice.generator';
import { StorageModule } from '../storage/storage.module';

@Global()
@Module({
  imports: [StorageModule],
  providers: [PdfService, PrescriptionPdfGenerator, InvoicePdfGenerator],
  exports: [PdfService, PrescriptionPdfGenerator, InvoicePdfGenerator],
})
export class PdfModule {}
