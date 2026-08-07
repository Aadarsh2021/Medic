export interface StorageAdapter {
  saveFile(fileBuffer: Buffer, storageKey: string, mimeType: string): Promise<string>;
  getFile(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}
