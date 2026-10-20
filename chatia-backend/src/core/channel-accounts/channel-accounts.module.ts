// src/core/channel-accounts/channel-accounts.module.ts
import { Module } from '@nestjs/common';
import { ChannelAccountsService } from '@/core/channel-accounts/channel-accounts.service.js';
import { WhatsAppOnboardingService } from '@/core/channel-accounts/whatsapp-onboarding.service.js';

@Module({
  providers: [ChannelAccountsService, WhatsAppOnboardingService],
  exports: [ChannelAccountsService, WhatsAppOnboardingService],
})
export class ChannelAccountsModule {}
