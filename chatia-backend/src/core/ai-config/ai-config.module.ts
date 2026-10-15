// src/core/ai-config/ai-config.module.ts
import { Module } from '@nestjs/common';
import { AiConfigService } from '@/core/ai-config/ai-config.service.js';

@Module({
  providers: [AiConfigService],
  exports: [AiConfigService],
})
export class AiConfigModule {}
