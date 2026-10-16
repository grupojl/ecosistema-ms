// src/infrastructure/channels/channel.module.ts
import { Module } from '@nestjs/common';
import { ChannelRegistry } from '@/infrastructure/channels/channel.registry.js';
import { ChannelMediaService } from '@/infrastructure/channels/channel-media.service.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';
import { InstagramChannel } from '@/infrastructure/channels/instagram/instagram.channel.js';
import { MessengerChannel } from '@/infrastructure/channels/messenger/messenger.channel.js';
import { TikTokChannel } from '@/infrastructure/channels/tiktok/tiktok.channel.js';

@Module({
  providers: [
    ChannelRegistry,
    WhatsAppChannel,
    InstagramChannel,
    MessengerChannel,
    TikTokChannel,
    ChannelMediaService,
  ],
  exports: [ChannelRegistry, ChannelMediaService],
})
export class ChannelsModule {}
