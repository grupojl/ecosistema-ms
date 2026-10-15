// src/infrastructure/channels/instagram/instagram.channel.ts
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  IChannel,
  IncomingMessage,
  OutgoingMessage,
  ChannelAccountConfig,
  MetaMessagingPayload,
} from '@/infrastructure/channels/channel.interface.js';

@Injectable()
export class InstagramChannel implements IChannel {
  private readonly logger = new Logger(InstagramChannel.name);
  private readonly API_URL = 'https://graph.facebook.com/v19.0';

  verifyWebhook(
    query: Record<string, string>,
    config: ChannelAccountConfig,
  ): string | false {
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === config.webhookVerifyToken
    ) {
      return query['hub.challenge'];
    }
    return false;
  }

  verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    const received = signature.replace('sha256=', '');
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(received, 'hex'),
      );
    } catch {
      return false;
    }
  }

  parseIncomingWebhook(payload: unknown): IncomingMessage[] | null {
    try {
      // Instagram usa el mismo formato de webhook que Messenger (Meta Messaging).
      // Meta agrupa varios eventos por request: se procesan TODOS (antes solo el primero).
      const messages: IncomingMessage[] = [];
      for (const entry of (payload as MetaMessagingPayload | null)?.entry ??
        []) {
        for (const messaging of entry?.messaging ?? []) {
          const msg = messaging.message;
          if (!msg) continue;
          messages.push({
            externalId: msg.mid,
            senderExternalId: messaging.sender.id,
            type: msg.attachments?.[0]?.type === 'image' ? 'image' : 'text',
            content:
              msg.text ?? msg.attachments?.[0]?.payload?.url ?? '[adjunto]',
            mediaUrl: msg.attachments?.[0]?.payload?.url,
            timestamp: new Date(messaging.timestamp),
            raw: messaging,
          });
        }
      }
      return messages.length ? messages : null;
    } catch (err) {
      this.logger.error('Error parseando webhook Instagram', err);
      return null;
    }
  }

  async sendMessage(
    msg: OutgoingMessage,
    config: ChannelAccountConfig,
  ): Promise<void> {
    const url = `${this.API_URL}/me/messages`;

    const body: Record<string, unknown> = {
      recipient: { id: msg.to },
      messaging_type: 'RESPONSE',
    };

    if (msg.type === 'text') {
      body.message = { text: msg.content };
    } else if (msg.type === 'image' && msg.mediaUrl) {
      body.message = {
        attachment: {
          type: 'image',
          payload: { url: msg.mediaUrl, is_reusable: true },
        },
      };
    }

    // Token en header (no en la query string: se filtraría a logs de proxies)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Instagram send failed: ${error}`);
    }
  }
}
