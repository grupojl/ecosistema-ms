// src/channels/channel.registry.ts
import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import type { IChannel } from '@/channels/channel.interface.js';
import { WhatsAppChannel } from '@/channels/whatsapp/whatsapp.channel.js';
import { InstagramChannel } from '@/channels/instagram/instagram.channel.js';
import { MessengerChannel } from '@/channels/messenger/messenger.channel.js';
import { TikTokChannel } from '@/channels/tiktok/tiktok.channel.js';

@Injectable()
export class ChannelRegistry {
  private readonly channels: Map<ChannelType, IChannel>;

  constructor(
    private readonly whatsapp: WhatsAppChannel,
    private readonly instagram: InstagramChannel,
    private readonly messenger: MessengerChannel,
    private readonly tiktok: TikTokChannel,
  ) {
    this.channels = new Map<ChannelType, IChannel>([
      [ChannelType.WHATSAPP, this.whatsapp],
      [ChannelType.INSTAGRAM, this.instagram],
      [ChannelType.MESSENGER, this.messenger],
      [ChannelType.TIKTOK, this.tiktok],
    ]);
  }

  get(type: ChannelType): IChannel {
    const channel = this.channels.get(type);
    if (!channel) throw new Error(`Canal no soportado: ${type}`);
    return channel;
  }
}