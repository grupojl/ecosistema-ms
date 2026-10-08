// src/groq/groq.module.ts
import { Module } from '@nestjs/common';
import { GroqService } from '@/infrastructure/groq/groq.service.js';
import { GroqCbService } from '@/infrastructure/groq/groq-cb.service.js';

@Module({
  providers: [GroqService, GroqCbService],
  exports: [GroqService, GroqCbService],
})
export class GroqModule {}
