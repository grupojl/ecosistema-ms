// src/core/privacy/privacy.module.ts
import { Module } from '@nestjs/common';
import { RetentionService } from '@/core/privacy/retention.service.js';

@Module({
  providers: [RetentionService],
  exports: [RetentionService],
})
export class PrivacyModule {}
