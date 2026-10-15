// src/infrastructure/groq/groq.module.ts
import { Module } from '@nestjs/common';
import { GroqService } from '@/infrastructure/groq/groq.service.js';

@Module({
  providers: [GroqService],
  exports: [GroqService],
})
export class GroqModule {}
