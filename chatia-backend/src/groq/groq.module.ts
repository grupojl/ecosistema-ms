// src/groq/groq.module.ts
import { Module } from '@nestjs/common';
import { GroqService } from '@/groq/groq.service';

@Module({
  providers: [GroqService],
  exports: [GroqService],
})
