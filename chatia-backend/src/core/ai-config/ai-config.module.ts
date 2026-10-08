// src/ai-config/ai-config.module.ts
import { Module } from '@nestjs/common';
import { AiConfigController } from '@/core/ai-config/ai-config.controller.js';
import { AiConfigService } from '@/core/ai-config/ai-config.service.js';

@Module({
  controllers: [AiConfigController],
  providers: [AiConfigService],
  exports: [AiConfigService],
})
export class AiConfigModule {}
