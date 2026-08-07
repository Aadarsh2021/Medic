import { Module, Global } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageAdapter } from './local-storage.adapter';
import { S3StorageAdapter } from './s3-storage.adapter';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [LocalStorageAdapter, S3StorageAdapter, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
