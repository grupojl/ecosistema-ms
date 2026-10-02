// src/ai-config/ai-config.module.ts
import { Module } from '@nestjs/common';
import { AiConfigController } from '@/ai-config/ai-config.controller.js';
import { AiConfigService } from '@/ai-config/ai-config.service.js';

@Module({
  controllers: [AiConfigController],
  providers: [AiConfigService],
  exports: [AiConfigService],
})
