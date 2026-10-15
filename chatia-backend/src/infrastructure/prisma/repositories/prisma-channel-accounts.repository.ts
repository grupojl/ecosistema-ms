// chatia-backend/src/infrastructure/prisma/repositories/prisma-channel-accounts.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type {
  ChannelAccount,
  ChannelType,
  Prisma,
} from '@/generated/prisma/client.js';
import type {
  ChannelAccountListItem,
  ChannelAccountWithAiConfig,
  CreateChannelAccountData,
  IChannelAccountsRepository,
  UpdateChannelAccountData,
} from '@/core/channel-accounts/repository/channel-accounts.repository.interface.js';

@Injectable()
export class PrismaChannelAccountsRepository implements IChannelAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateChannelAccountData): Promise<ChannelAccount> {
    return this.prisma.channelAccount.create({
      data: { ...data, extraConfig: data.extraConfig as Prisma.InputJsonValue },
    });
  }

  listByOrganization(
    organizationId: string,
  ): Promise<ChannelAccountListItem[]> {
    return this.prisma.channelAccount.findMany({
      where: { organizationId },
      include: {
        aiConfig: { select: { isEnabled: true, personaName: true } },
        _count: { select: { conversations: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOwned(
    id: string,
    organizationId: string,
  ): Promise<ChannelAccountWithAiConfig | null> {
    return this.prisma.channelAccount.findFirst({
      where: { id, organizationId },
      include: { aiConfig: true },
    });
  }

  update(id: string, data: UpdateChannelAccountData): Promise<ChannelAccount> {
    const { extraConfig, ...rest } = data;
    return this.prisma.channelAccount.update({
      where: { id },
      data: {
        ...rest,
        ...(extraConfig !== undefined && {
          extraConfig: extraConfig as Prisma.InputJsonValue,
        }),
      },
    });
  }

  findByChannel(
    channelType: ChannelType,
    externalId: string,
  ): Promise<ChannelAccount | null> {
    return this.prisma.channelAccount.findUnique({
      where: { channelType_externalId: { channelType, externalId } },
    });
  }
}
