// src/messages/messages.module.ts
import { Module } from '@nestjs/common';
import { MessagesController } from '@/messages/messages.controller';
import { MessagesService } from '@/messages/messages.service';

@Module({
  controllers: [MessagesController],
  providers: [MessagesService],
  exports: [MessagesService],
})
