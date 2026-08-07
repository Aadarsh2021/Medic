import { Module } from '@nestjs/common';
import { EMRController } from './emr.controller';
import { EMRService } from './emr.service';

@Module({
  controllers: [EMRController],
  providers: [EMRService],
  exports: [EMRService],
})
export class EMRModule {}
