// @ecosistema-ms/zod-migrated
// src/core/channel-accounts/channel-accounts.service.ts
import { Inject, Logger, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateChannelAccountInput,
  UpdateChannelAccountInput,
} from '@/core/channel-accounts/schemas.js';
import {
  CHANNEL_ACCOUNTS_REPOSITORY,
  type IChannelAccountsRepository,
} from '@/core/channel-accounts/repository/channel-accounts.repository.interface.js';
import { randomUUID } from 'crypto';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';

/** Campos secretos que NUNCA salen en una respuesta de la API (el dashboard solo necesita saber si existen). */
export function toPublicAccount<
  T extends { accessToken?: string | null; extraConfig?: unknown },
>(account: T) {
  const { accessToken, extraConfig, ...rest } = account;
  const { appSecret, ...safeExtra } = (extraConfig ?? {}) as Record<
    string,
    unknown
  >;
  return {
    ...rest,
    extraConfig: safeExtra,
    hasAccessToken: Boolean(accessToken),
    hasAppSecret: typeof appSecret === 'string' && appSecret.length > 0,
  };
}

@Injectable()
export class ChannelAccountsService {
  private readonly logger = new Logger(ChannelAccountsService.name);
  constructor(
    @Inject(CHANNEL_ACCOUNTS_REPOSITORY)
    private readonly repo: IChannelAccountsRepository,
    private readonly cipher: TokenCipher,
  ) {}

  async create(organizationId: string, dto: CreateChannelAccountInput) {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3010';

    const account = await this.repo.create({
      organizationId,
      channelType: dto.channelType,
      name: dto.name,
      externalId: dto.externalId,
      // Cifrado en reposo: el token y el appSecret nunca se guardan en claro (TokenCipher)
      accessToken: this.cipher.encrypt(dto.accessToken),
      extraConfig: this.cipher.encryptExtraConfig(dto.extraConfig ?? {}),
      webhookVerifyToken: randomUUID(),
    });

    return {
      success: true,
      data: {
        ...toPublicAccount(account),
        webhookUrl: `${appUrl}/api/v1/webhooks/${dto.channelType.toLowerCase()}/${dto.externalId}`,
      },
    };
  }

  async list(organizationId: string) {
    const accounts = await this.repo.listByOrganization(organizationId);

    return { success: true, data: accounts.map((a) => toPublicAccount(a)) };
  }

  async findOne(id: string, organizationId: string) {
    const account = await this.repo.findOwned(id, organizationId);

    if (!account) throw new NotFoundException('Cuenta no encontrada');
    return { success: true, data: toPublicAccount(account) };
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateChannelAccountInput,
  ) {
    const account = await this.repo.findOwned(id, organizationId);

    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const existingAppSecret = (
      account.extraConfig as { appSecret?: string } | null
    )?.appSecret;

    const updated = await this.repo.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.accessToken !== undefined && {
        accessToken: this.cipher.encrypt(dto.accessToken),
      }),
      // El appSecret nunca se devuelve al cliente: si edita extraConfig sin reenviarlo, se conserva el existente
      ...(dto.extraConfig !== undefined && {
        extraConfig: this.cipher.encryptExtraConfig({
          ...dto.extraConfig,
          // existingAppSecret ya está guardado cifrado: encrypt() no lo vuelve a cifrar
          ...(!('appSecret' in dto.extraConfig) && existingAppSecret
            ? { appSecret: existingAppSecret }
            : {}),
        }),
      }),
    });

    return { success: true, data: toPublicAccount(updated) };
  }

  async rotateToken(id: string, organizationId: string) {
    const account = await this.repo.findOwned(id, organizationId);

    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const updated = await this.repo.update(id, {
      webhookVerifyToken: randomUUID(),
    });

    return {
      success: true,
      message: 'Token rotado. Actualizá el webhook en el panel del canal.',
      data: { webhookVerifyToken: updated.webhookVerifyToken },
    };
  }
}
