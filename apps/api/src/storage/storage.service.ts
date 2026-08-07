import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { PrismaService } from '../prisma/prisma.service';
const sharp = require('sharp');
import * as crypto from 'crypto';
import * as path from 'path';

export type FileCategory =
  | 'PROFILE_IMAGE'
  | 'HOSPITAL_LOGO'
  | 'LAB_ATTACHMENT'
  | 'MEDICAL_RECORD'
  | 'PDF_DOCUMENT';

const CATEGORY_SIZE_LIMITS: Record<FileCategory, number> = {
  PROFILE_IMAGE: 2 * 1024 * 1024, // 2MB
  HOSPITAL_LOGO: 2 * 1024 * 1024, // 2MB
  LAB_ATTACHMENT: 10 * 1024 * 1024, // 10MB
  MEDICAL_RECORD: 10 * 1024 * 1024, // 10MB
  PDF_DOCUMENT: 10 * 1024 * 1024, // 10MB
};

const CATEGORY_ALLOWED_EXTENSIONS: Record<FileCategory, string[]> = {
  PROFILE_IMAGE: ['.jpg', '.jpeg', '.png', '.webp'],
  HOSPITAL_LOGO: ['.jpg', '.jpeg', '.png', '.webp'],
  LAB_ATTACHMENT: ['.pdf', '.jpg', '.jpeg', '.png'],
  MEDICAL_RECORD: ['.pdf', '.jpg', '.jpeg', '.png'],
  PDF_DOCUMENT: ['.pdf'],
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    private readonly localAdapter: LocalStorageAdapter,
    private readonly s3Adapter: S3StorageAdapter,
    private readonly prisma: PrismaService,
  ) {}

  private getAdapter() {
    if (process.env.STORAGE_PROVIDER === 's3') {
      return this.s3Adapter;
    }
    return this.localAdapter;
  }

  /**
   * Validates file signature (magic bytes) against expected formats and rejects prohibited scripts/markup.
   */
  validateFileContent(buffer: Buffer, originalExtension: string): string {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException({
        success: false,
        error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty.' },
      });
    }

    const ext = originalExtension.toLowerCase().trim();

    // Check prohibited script tags or executable signatures
    const bufferHead = buffer.subarray(0, 512).toString('utf8').toLowerCase();
    if (
      bufferHead.includes('<script') ||
      bufferHead.includes('<html') ||
      bufferHead.includes('javascript:') ||
      bufferHead.includes('<?php')
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_FILE_CONTENT',
          message: 'File contains prohibited executable code or HTML script markup.',
        },
      });
    }

    // Magic Bytes Verification
    let detectedMime = '';
    const headerHex = buffer.subarray(0, 8).toString('hex').toUpperCase();

    if (headerHex.startsWith('FFD8FF')) {
      detectedMime = 'image/jpeg';
    } else if (headerHex.startsWith('89504E47')) {
      detectedMime = 'image/png';
    } else if (headerHex.startsWith('52494646') && buffer.subarray(8, 12).toString('utf8') === 'WEBP') {
      detectedMime = 'image/webp';
    } else if (headerHex.startsWith('25504446')) {
      detectedMime = 'application/pdf';
    }

    if (!detectedMime) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_FILE_CONTENT',
          message: 'File binary signature does not match any allowed file type.',
        },
      });
    }

    // Validate mime matches extension extension
    const extMimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };

    if (extMimeMap[ext] !== detectedMime) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_FILE_CONTENT',
          message: `File extension (${ext}) does not match content binary signature (${detectedMime}).`,
        },
      });
    }

    return detectedMime;
  }

  /**
   * Processes images via Sharp: re-encodes, strips metadata, normalizes dimensions.
   */
  async processImageIfNeeded(buffer: Buffer, category: FileCategory, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
    if ((category === 'PROFILE_IMAGE' || category === 'HOSPITAL_LOGO') && mimeType.startsWith('image/')) {
      try {
        const processedBuffer = await sharp(buffer)
          .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
          .png({ quality: 85 })
          .toBuffer();

        return { buffer: processedBuffer, mimeType: 'image/png' };
      } catch (err) {
        this.logger.error(`Sharp image processing failed: ${err.message}`);
        throw new BadRequestException({
          success: false,
          error: { code: 'IMAGE_PROCESSING_FAILED', message: 'Failed to process and normalize uploaded image.' },
        });
      }
    }
    return { buffer, mimeType };
  }

  /**
   * Handles safe file upload and records metadata in PostgreSQL.
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalFilename: string,
    category: FileCategory,
    user: any,
  ) {
    if (!CATEGORY_SIZE_LIMITS[category]) {
      throw new BadRequestException({
        success: false,
        error: { code: 'UNSUPPORTED_CATEGORY', message: `Invalid file category: ${category}` },
      });
    }

    // Size limit check
    const maxAllowedSize = CATEGORY_SIZE_LIMITS[category];
    if (fileBuffer.length > maxAllowedSize) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: `File size exceeds the allowed limit of ${maxAllowedSize / (1024 * 1024)}MB for ${category}.`,
        },
      });
    }

    // Safe extension check
    const safeExt = path.extname(originalFilename || '').toLowerCase();
    const allowedExts = CATEGORY_ALLOWED_EXTENSIONS[category];
    if (!allowedExts || !allowedExts.includes(safeExt)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'UNSUPPORTED_FILE_TYPE',
          message: `File extension ${safeExt} is not allowed for category ${category}. Allowed: ${allowedExts.join(', ')}`,
        },
      });
    }

    // Magic Bytes & Content Security Verification
    const validatedMime = this.validateFileContent(fileBuffer, safeExt);

    // Sharp Image Processing
    const { buffer: finalBuffer, mimeType: finalMime } = await this.processImageIfNeeded(fileBuffer, category, validatedMime);

    // Safe storage key generation
    const hospitalId = user.hospitalId || 'global';
    const safeFilename = `${crypto.randomUUID()}${safeExt}`;
    const storageKey = `${hospitalId}/${category}/${safeFilename}`;

    const adapter = this.getAdapter();
    await adapter.saveFile(finalBuffer, storageKey, finalMime);

    // Save FileMetadata record in PostgreSQL
    const fileRecord = await (this.prisma as any).fileMetadata.create({
      data: {
        hospitalId: user.role === 'SUPER_ADMIN' ? hospitalId : user.hospitalId,
        uploaderUserId: user.id,
        category,
        originalFilename: path.basename(originalFilename),
        mimeType: finalMime,
        size: finalBuffer.length,
        storageKey,
        isPublic: false,
      },
    });

    return fileRecord;
  }

  /**
   * Retrieves file buffer with tenant and patient authorization checks.
   */
  async getFileWithAuthorization(fileIdOrKey: string, user: any): Promise<{ buffer: Buffer; fileMetadata: any }> {
    let metadata = await (this.prisma as any).fileMetadata.findFirst({
      where: {
        OR: [{ id: fileIdOrKey }, { storageKey: fileIdOrKey }],
      },
    });

    if (!metadata) {
      throw new NotFoundException({
        success: false,
        error: { code: 'FILE_NOT_FOUND', message: 'File record not found.' },
      });
    }

    // Tenant Isolation Check
    if (user.role !== 'SUPER_ADMIN' && metadata.hospitalId !== user.hospitalId) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have access to files from another hospital.' },
      });
    }

    // Patient Isolation Check: Patients can only access their own uploaded files or public files
    if (user.role === 'PATIENT' && metadata.uploaderUserId !== user.id && !metadata.isPublic) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You do not have authorization to access this file.' },
      });
    }

    const adapter = this.getAdapter();
    const buffer = await adapter.getFile(metadata.storageKey);

    return { buffer, fileMetadata: metadata };
  }

  /**
   * Direct method for internal services (e.g. PDF Engine) to save generated files.
   */
  async saveInternalFile(buffer: Buffer, storageKey: string, mimeType: string): Promise<string> {
    const adapter = this.getAdapter();
    return await adapter.saveFile(buffer, storageKey, mimeType);
  }

  /**
   * Direct method for internal services to read stored files.
   */
  async getInternalFile(storageKey: string): Promise<Buffer> {
    const adapter = this.getAdapter();
    return await adapter.getFile(storageKey);
  }
}
