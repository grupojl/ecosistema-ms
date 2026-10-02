// src/langgraph/langgraph.module.ts
import { Module } from '@nestjs/common';
import { LangGraphEngine } from '@/langgraph/langgraph.engine.js';
import { GroqModule } from '@/groq/groq.module.js';
import { PrismaModule } from '@/prisma/prisma.module.js';

@Module({
  imports: [GroqModule, PrismaModule],
  providers: [LangGraphEngine],
  exports: [LangGraphEngine],
})
