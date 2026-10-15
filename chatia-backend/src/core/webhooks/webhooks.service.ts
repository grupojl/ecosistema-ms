// src/core/webhooks/webhooks.service.ts
import { addWithTimeout } from '@/infrastructure/queue/add-with-timeout.js';
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CHANNEL_ACCOUNTS_REPOSITORY,
  type IChannelAccountsRepository,
} from '@/core/channel-accounts/repository/channel-accounts.repository.interface.js';
import { ChannelRegistry } from '@/infrastructure/channels/channel.registry.js';
import { ChannelType } from '@/generated/prisma/client.js';
import { QUEUES, JOBS } from '@/infrastructure/queue/queue.constants.js';
import { resolveSignatureSecret } from '@/core/webhooks/webhook-signature.js';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import type { IncomingMessageJobData } from '@/infrastructure/queue/processors/incoming-message.processor.js';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject(CHANNEL_ACCOUNTS_REPOSITORY)
    private readonly accounts: IChannelAccountsRepository,
    private readonly channelRegistry: ChannelRegistry,
    @Optional()
    @InjectQueue(QUEUES.INCOMING_MESSAGE)
    private readonly incomingQueue: Queue<IncomingMessageJobData> | null,
    private readonly cipher: TokenCipher,
  ) {}

  /**
   * Todo rechazo de autenticación responde IGUAL (401 sin detalle): un mensaje distinto por causa permitiría saber
   * qué cuentas existen. La causa real queda solo en el log.
   */
  private deny(reason: string): UnauthorizedException {
    this.logger.warn(`Webhook rechazado: ${reason}`);
    return new UnauthorizedException();
  }

  async verify(
    channelType: ChannelType,
    externalId: string,
    query: Record<string, string>,
  ) {
    const account = await this.accounts.findByChannel(channelType, externalId);
    if (!account) throw this.deny('Cuenta inexistente');

    const channel = this.channelRegistry.get(channelType);
    const challenge = channel.verifyWebhook(query, {
      externalId: account.externalId,
      accessToken: this.cipher.decrypt(account.accessToken),
      extraConfig: account.extraConfig as Record<string, unknown>,
      webhookVerifyToken: account.webhookVerifyToken,
    });

    if (challenge === false) throw this.deny('Token inválido');
    return challenge;
  }

  async handleEvent(
    channelType: ChannelType,
    externalId: string,
    payload: unknown,
    rawBody: Buffer | undefined,
    signature?: string,
  ) {
    const account = await this.accounts.findByChannel(channelType, externalId);
    if (!account) throw this.deny('Cuenta inexistente');

    const channel = this.channelRegistry.get(channelType);

    // Firma OBLIGATORIA: sin header, cuerpo crudo o secreto configurado, se rechaza (fail closed).
    if (!signature) throw this.deny('Firma ausente');
    if (!rawBody || rawBody.length === 0)
      throw this.deny('Cuerpo crudo no disponible');

    const secret = resolveSignatureSecret(
      channelType,
      account.extraConfig,
      process.env,
      (v) => this.cipher.decrypt(v),
    );
    if (!secret) {
      this.logger.error(
        `[ALERTA TÉCNICA] Sin App Secret para ${channelType} (META_APP_SECRET / TIKTOK_APP_SECRET / extraConfig.appSecret)`,
      );
      throw this.deny('Canal sin secreto de firma configurado');
    }
    if (!channel.verifySignature)
      throw this.deny('Canal sin verificación de firma');
    if (!channel.verifySignature(rawBody, signature, secret)) {
      this.logger.warn(
        `Firma inválida en webhook ${channelType}/${externalId}`,
      );
      throw this.deny('Firma inválida');
    }

    const msg = channel.parseIncomingWebhook(payload);
    if (!msg || msg.length === 0) return { status: 'ignored' };

    if (!this.incomingQueue) {
      this.logger.warn(
        '[no-op] webhook recibido pero cola deshabilitada (REDIS_ENABLED=false)',
      );
      return { status: 'ok-noop' };
    }

    const incoming = this.incomingQueue;
    for (const m of msg) {
      await addWithTimeout(
        () =>
          incoming.add(
            JOBS.PROCESS_MESSAGE,
            { channelAccountId: account.id, channelType, msg: m },
            {
              jobId: `msg_${account.id}_${m.externalId.replace(/:/g, '_')}`,
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
            },
          ),
        QUEUES.INCOMING_MESSAGE,
      );
    }

    return { status: 'ok' };
  }
}
