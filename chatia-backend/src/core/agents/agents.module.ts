// src/agents/agents.module.ts
import { Module } from '@nestjs/common';
import { AgentsController } from '@/agents/agents.controller.js';

@Module({
  controllers: [AgentsController],
})
export class AgentsModule {}
