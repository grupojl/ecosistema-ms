// chatia-backend/src/core/channel-accounts/repository/channel-accounts.repository.interface.ts
import type {
  AiConfig,
  ChannelAccount,
  ChannelType,
} from '@/generated/prisma/client.js';

export const CHANNEL_ACCOUNTS_REPOSITORY = Symbol(
  'CHANNEL_ACCOUNTS_REPOSITORY',
);

export type ChannelAccountWithAiConfig = ChannelAccount & {
  aiConfig: AiConfig | null;
};

export type ChannelAccountListItem = ChannelAccount & {
  aiConfig: { isEnabled: boolean; personaName: string } | null;
  _count: { conversations: number };
};

export interface CreateChannelAccountData {
  organizationId: string;
  channelType: ChannelType;
  name: string;
  externalId: string;
  /** Ya cifrado por el service (TokenCipher). */
  accessToken: string;
  /** Ya cifrado por el service (TokenCipher). */
  extraConfig: Record<string, unknown>;
  webhookVerifyToken: string;
}

export interface UpdateChannelAccountData {
  name?: string;
  accessToken?: string;
  extraConfig?: Record<string, unknown>;
  webhookVerifyToken?: string;
}

export interface IChannelAccountsRepository {
  create(data: CreateChannelAccountData): Promise<ChannelAccount>;
  listByOrganization(organizationId: string): Promise<ChannelAccountListItem[]>;
  /** Solo si la cuenta es de la organización. */
  findOwned(
    id: string,
    organizationId: string,
  ): Promise<ChannelAccountWithAiConfig | null>;
  update(id: string, data: UpdateChannelAccountData): Promise<ChannelAccount>;
  /** Búsqueda por la clave única del canal (usada por los webhooks). */
  findByChannel(
    channelType: ChannelType,
    externalId: string,
  ): Promise<ChannelAccount | null>;
}
