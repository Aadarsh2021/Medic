import { Injectable, Logger } from '@nestjs/common';
import { StorageAdapter } from './storage.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.env.STORAGE_LOCAL_PATH || './uploads');
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private sanitizeKey(storageKey: string): string {
    // Strip path traversal sequences (../, ..\, leading slashes)
    const sanitized = storageKey.replace(/\\/g, '/').replace(/\.\.\//g, '').replace(/^\/+/, '');
    return path.normalize(sanitized);
  }

  private getAbsolutePath(storageKey: string): string {
    const safeKey = this.sanitizeKey(storageKey);
    const fullPath = path.resolve(this.baseDir, safeKey);

    // Prevent directory traversal escape outside baseDir
    if (!fullPath.startsWith(this.baseDir)) {
      throw new Error('Path traversal attempt detected');
    }
    return fullPath;
  }

  async saveFile(fileBuffer: Buffer, storageKey: string, _mimeType: string): Promise<string> {
    const fullPath = this.getAbsolutePath(storageKey);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(fullPath, fileBuffer);
    this.logger.log(`Saved file to local storage: ${storageKey}`);
    return storageKey;
  }

  async getFile(storageKey: string): Promise<Buffer> {
    const fullPath = this.getAbsolutePath(storageKey);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${storageKey}`);
    }
    return await fs.promises.readFile(fullPath);
  }

  async deleteFile(storageKey: string): Promise<void> {
    const fullPath = this.getAbsolutePath(storageKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      this.logger.log(`Deleted file from local storage: ${storageKey}`);
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      const fullPath = this.getAbsolutePath(storageKey);
      return fs.existsSync(fullPath);
    } catch (e) {
      return false;
    }
  }
}
