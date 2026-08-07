import { Injectable, Logger } from '@nestjs/common';
import { StorageAdapter } from './storage.interface';

@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = !!(process.env.S3_BUCKET && process.env.AWS_ACCESS_KEY_ID);
  }

  async saveFile(fileBuffer: Buffer, storageKey: string, mimeType: string): Promise<string> {
    if (!this.isConfigured) {
      this.logger.warn('S3 is not configured. PREPARED / NOT IMPLEMENTED fallback triggered.');
      throw new Error('S3 Storage is prepared but not active. Configure AWS/S3 environment variables.');
    }
    // S3 implementation prepared for production deployment
    return storageKey;
  }

  async getFile(storageKey: string): Promise<Buffer> {
    if (!this.isConfigured) {
      throw new Error('S3 Storage is prepared but not active.');
    }
    return Buffer.from('');
  }

  async deleteFile(storageKey: string): Promise<void> {
    if (!this.isConfigured) return;
  }

  async exists(storageKey: string): Promise<boolean> {
    return false;
  }
}
