// src/channel-accounts/channel-accounts.module.ts
import { Module } from '@nestjs/common';
import { ChannelAccountsController } from '@/channel-accounts/channel-accounts.controller.js';
import { ChannelAccountsService } from '@/channel-accounts/channel-accounts.service.js';

@Module({
  controllers: [ChannelAccountsController],
  providers: [ChannelAccountsService],
  exports: [ChannelAccountsService],
})
export class ChannelAccountsModule {}
