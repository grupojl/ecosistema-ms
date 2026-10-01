// src/channels/channel.module.ts
import { Module } from '@nestjs/common';
import { ChannelRegistry } from '@/channels/channel.registry.js';
import { WhatsAppChannel } from '@/channels/whatsapp/whatsapp.channel.js';
import { InstagramChannel } from '@/channels/instagram/instagram.channel.js';
import { MessengerChannel } from '@/channels/messenger/messenger.channel.js';
import { TikTokChannel } from '@/channels/tiktok/tiktok.channel.js';

@Module({
  providers: [
    ChannelRegistry,
    WhatsAppChannel,
    InstagramChannel,
    MessengerChannel,
    TikTokChannel,
  ],
  exports: [ChannelRegistry],
})
export class ChannelsModule {}
