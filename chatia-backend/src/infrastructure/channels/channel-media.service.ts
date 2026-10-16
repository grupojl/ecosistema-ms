// src/infrastructure/channels/channel-media.service.ts
//
// Resuelve, para un mensaje entrante, la organización dueña de la cuenta y — si el canal solo trae una
// referencia de medio (WhatsApp: media-id) — la URL descargable con su autenticación.
// El token se abre acá, en el worker: el job viaja por Redis con la referencia, nunca con credenciales.
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ChannelType } from '@/generated/prisma/client.js';
import {
  CONVERSATIONS_REPOSITORY,
  type IConversationsRepository,
} from '@/core/conversations/repository/conversations.repository.interface.js';
import { ChannelRegistry } from '@/infrastructure/channels/channel.registry.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import type {
  IncomingMessage,
  ResolvedMedia,
} from '@/infrastructure/channels/channel.interface.js';

export interface IncomingMediaContext {
  organizationId: string;
  media?: ResolvedMedia;
}

@Injectable()
export class ChannelMediaService {
  private readonly logger = new Logger(ChannelMediaService.name);

  constructor(
    @Inject(CONVERSATIONS_REPOSITORY)
    private readonly conversations: IConversationsRepository,
    private readonly registry: ChannelRegistry,
    private readonly cipher: TokenCipher,
  ) {}

  /**
   * Si no se puede resolver el medio devuelve solo la organización: el adaptador degrada al
   * mensaje de "no pude leerlo" en vez de hacer fallar (y reintentar) todo el mensaje entrante.
   */
  async resolve(
    channelAccountId: string,
    channelType: ChannelType,
    msg: IncomingMessage,
  ): Promise<IncomingMediaContext> {
    const account =
      await this.conversations.findChannelAccountById(channelAccountId);
    if (!account) return { organizationId: '' };

    const ctx: IncomingMediaContext = {
      organizationId: account.organizationId,
    };
    if (!msg.mediaUrl) return ctx;

    const channel = this.registry.get(channelType);
    if (!channel.resolveMedia) return ctx;

    try {
      ctx.media = await channel.resolveMedia(msg.mediaUrl, {
        externalId: account.externalId,
        accessToken: this.cipher.decrypt(account.accessToken),
        extraConfig: account.extraConfig,
        webhookVerifyToken: '',
      });
    } catch (err) {
      this.logger.warn(
        `[${channelType}] no se pudo resolver el medio del mensaje ${msg.externalId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Sin `media`, el adaptador intenta descargar el id como URL, falla y degrada al texto de respaldo
    }
    return ctx;
  }
}
