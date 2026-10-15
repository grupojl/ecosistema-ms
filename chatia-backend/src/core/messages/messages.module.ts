// src/core/messages/messages.module.ts
import { Module } from '@nestjs/common';
import { MessagesService } from '@/core/messages/messages.service.js';

@Module({
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
