// src/channels/channel.module.ts
import { Module } from '@nestjs/common';
import { ChannelRegistry } from '@/channels/channel.registry';
import { WhatsAppChannel } from '@/channels/whatsapp/whatsapp.channel';
import { InstagramChannel } from '@/channels/instagram/instagram.channel';
import { MessengerChannel } from '@/channels/messenger/messenger.channel';
import { TikTokChannel } from '@/channels/tiktok/tiktok.channel';

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
