// src/messages/messages.module.ts
import { Module } from '@nestjs/common';
import { MessagesController } from '@/core/messages/messages.controller.js';
import { MessagesService } from '@/core/messages/messages.service.js';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
export class MessagesModule {}
