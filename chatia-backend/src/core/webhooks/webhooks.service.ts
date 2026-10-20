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
import { safeEqual } from '@/infrastructure/security/safe-equal.js';
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
    if (account.isActive === false) throw this.deny('Cuenta desconectada');

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
    if (account.isActive === false) throw this.deny('Cuenta desconectada');

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

    return this.enqueue(account, channelType, payload);
  }

  /**
   * Verificación (GET) del webhook ÚNICO de la app de Meta de la plataforma (Tech Provider, ADR-024).
   * Meta registra una sola URL de callback para todos los clientes: no puede llevar el id de cada número, y el
   * verify token es de la plataforma (META_WEBHOOK_VERIFY_TOKEN), no de una cuenta.
   */
  verifyPlatform(query: Record<string, string>): string {
    const expected = process.env['META_WEBHOOK_VERIFY_TOKEN'];
    if (!expected) throw this.deny('META_WEBHOOK_VERIFY_TOKEN sin configurar');
    if (
      query['hub.mode'] !== 'subscribe' ||
      !safeEqual(query['hub.verify_token'], expected)
    ) {
      throw this.deny('Verify token de plataforma inválido');
    }
    return query['hub.challenge'] ?? '';
  }

  /**
   * Eventos (POST) de WhatsApp en el webhook único: la firma se valida UNA vez con META_APP_SECRET sobre el cuerpo
   * crudo, y cada cambio se enruta a la cuenta dueña del `phone_number_id` (metadata del payload). Un número que no
   * es nuestro o está desconectado se ignora sin fallar el lote: Meta reintenta los lotes que devuelven error.
   */
  async handlePlatformEvent(
    payload: unknown,
    rawBody: Buffer | undefined,
    signature?: string,
  ) {
    const secret = process.env['META_APP_SECRET'];
    if (!secret) throw this.deny('META_APP_SECRET sin configurar');
    if (!signature) throw this.deny('Firma ausente');
    if (!rawBody || rawBody.length === 0)
      throw this.deny('Cuerpo crudo no disponible');
    const channel = this.channelRegistry.get(ChannelType.WHATSAPP);
    if (!channel.verifySignature?.(rawBody, signature, secret)) {
      throw this.deny('Firma inválida');
    }

    const entries =
      (payload as { entry?: Array<{ changes?: unknown[] }> } | null)?.entry ??
      [];
    let processed = 0;
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = (
          change as { value?: { metadata?: { phone_number_id?: unknown } } }
        ).value?.metadata?.phone_number_id;
        if (typeof phoneNumberId !== 'string') continue;

        const account = await this.accounts.findByChannel(
          ChannelType.WHATSAPP,
          phoneNumberId,
        );
        if (!account || account.isActive === false) {
          this.logger.warn(
            `Webhook de plataforma para un número no conectado: ${phoneNumberId}`,
          );
          continue;
        }
        await this.enqueue(account, ChannelType.WHATSAPP, {
          ...(payload as object),
          entry: [{ ...entry, changes: [change] }],
        });
        processed++;
      }
    }
    return { status: processed > 0 ? 'ok' : 'ignored' };
  }

  private async enqueue(
    account: { id: string },
    channelType: ChannelType,
    payload: unknown,
  ) {
    const channel = this.channelRegistry.get(channelType);
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
