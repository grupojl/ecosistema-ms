// src/core/channel-accounts/channel-accounts.module.ts
import { Module } from '@nestjs/common';
import { ChannelAccountsService } from '@/core/channel-accounts/channel-accounts.service.js';

@Module({
  providers: [ChannelAccountsService],
  exports: [ChannelAccountsService],
})
export class ChannelAccountsModule {}
