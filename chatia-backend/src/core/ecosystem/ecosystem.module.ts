// src/core/ecosystem/ecosystem.module.ts
import { Module } from '@nestjs/common';
import { EcosystemService } from '@/core/ecosystem/ecosystem.service.js';

@Module({
  providers: [EcosystemService],
  exports: [EcosystemService],
})
export class EcosystemModule {}
