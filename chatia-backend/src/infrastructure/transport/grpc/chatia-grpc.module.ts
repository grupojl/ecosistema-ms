// src/infrastructure/transport/grpc/chatia-grpc.module.ts
import { Module } from '@nestjs/common';
import { ChatiaGrpcController } from '@/infrastructure/transport/grpc/chatia-grpc.controller.js';
import { GrpcAuthGuard } from '@/infrastructure/transport/grpc/grpc-auth.guard.js';
import { AssistantModule } from '@/core/assistant/assistant.module.js';
import { FaqModule } from '@/core/faq/faq.module.js';

@Module({
  imports: [AssistantModule, FaqModule],
  controllers: [ChatiaGrpcController],
  providers: [GrpcAuthGuard],
})
export class ChatiaServerGrpcModule {}
