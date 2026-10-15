// chatia-backend/src/infrastructure/prisma/repositories/prisma-ai-config.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { AiConfig } from '@/generated/prisma/client.js';
import type {
  AiConfigCreateData,
  AiConfigUpdateData,
  IAiConfigRepository,
} from '@/core/ai-config/repository/ai-config.repository.interface.js';

@Injectable()
export class PrismaAiConfigRepository implements IAiConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async channelAccountBelongsTo(
    channelAccountId: string,
    organizationId: string,
  ): Promise<boolean> {
    const account = await this.prisma.channelAccount.findFirst({
      where: { id: channelAccountId, organizationId },
      select: { id: true },
    });
    return account !== null;
  }

  findByChannelAccount(channelAccountId: string): Promise<AiConfig | null> {
    return this.prisma.aiConfig.findUnique({ where: { channelAccountId } });
  }

  create(data: AiConfigCreateData): Promise<AiConfig> {
    return this.prisma.aiConfig.create({ data });
  }

  upsert(
    channelAccountId: string,
    create: AiConfigCreateData,
    update: AiConfigUpdateData,
  ): Promise<AiConfig> {
    return this.prisma.aiConfig.upsert({
      where: { channelAccountId },
      create,
      update,
    });
  }

  setEnabled(channelAccountId: string, enabled: boolean): Promise<AiConfig> {
    return this.prisma.aiConfig.update({
      where: { channelAccountId },
      data: { isEnabled: enabled },
    });
  }
}
