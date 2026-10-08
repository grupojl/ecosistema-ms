// src/langgraph/langgraph.module.ts
import { Module } from '@nestjs/common';
import { LangGraphEngine } from '@/infrastructure/langgraph/langgraph.engine.js';
import { GroqModule } from '@/infrastructure/groq/groq.module.js';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module.js';

@Module({
  imports: [GroqModule, PrismaModule],
  providers: [LangGraphEngine],
  exports: [LangGraphEngine],
})
export class LangGraphModule {}
