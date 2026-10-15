// chatia-backend/src/core/agents/agents.module.ts
// El binding AGENTS_REPOSITORY → implementación Prisma vive en infrastructure/prisma/prisma.module.ts.
import { Module } from '@nestjs/common';
import { AgentsService } from '@/core/agents/agents.service.js';

@Module({
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
