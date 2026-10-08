// src/ecosystem/ecosystem.module.ts
import { Module } from '@nestjs/common';
import { EcosystemService }    from '@/core/ecosystem/ecosystem.service.js';
import { EcosystemController } from '@/core/ecosystem/ecosystem.controller.js';

@Module({
  controllers: [EcosystemController],
  providers:   [EcosystemService],
  exports:     [EcosystemService],
})
export class EcosystemModule {}
