// chatia-backend/src/infrastructure/prisma/repositories/prisma-assistant.repository.ts
// Implementaciones Prisma de los repositories del asistente (configuración y sesiones).
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type {
  AssistantConfig,
  AssistantSession,
} from '@/generated/prisma/client.js';
import type { UpdateAssistantConfigInput } from '@/core/assistant/schemas.js';
import type {
  CreateSessionData,
  IAssistantConfigRepository,
  IAssistantSessionRepository,
} from '@/core/assistant/repository/assistant.repository.interface.js';

@Injectable()
export class PrismaAssistantConfigRepository implements IAssistantConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByProjectId(projectId: string): Promise<AssistantConfig | null> {
    return this.prisma.assistantConfig.findUnique({ where: { projectId } });
  }

  findOwned(
    projectId: string,
    organizationId: string,
  ): Promise<AssistantConfig | null> {
    return this.prisma.assistantConfig.findFirst({
      where: { projectId, organizationId },
    });
  }

  create(data: {
    projectId: string;
    organizationId: string;
    systemPrompt: string;
  }): Promise<AssistantConfig> {
    return this.prisma.assistantConfig.create({ data });
  }

  update(
    projectId: string,
    data: UpdateAssistantConfigInput,
  ): Promise<AssistantConfig> {
    return this.prisma.assistantConfig.update({ where: { projectId }, data });
  }

  setEnabled(projectId: string, enabled: boolean): Promise<AssistantConfig> {
    return this.prisma.assistantConfig.update({
      where: { projectId },
      data: { isEnabled: enabled },
    });
  }

  findEnabledModelForOrganization(
    organizationId: string,
  ): Promise<{ groqModel: string } | null> {
    return this.prisma.assistantConfig.findFirst({
      where: { organizationId, isEnabled: true },
      select: { groqModel: true },
    });
  }
}

@Injectable()
export class PrismaAssistantSessionRepository implements IAssistantSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForChannel(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
    channel: string,
  ): Promise<AssistantSession | null> {
    return this.prisma.assistantSession.findFirst({
      where: { assistantConfigId, organizationId, externalUserId, channel },
    });
  }

  findLatestByUser(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
  ): Promise<AssistantSession | null> {
    return this.prisma.assistantSession.findFirst({
      where: { assistantConfigId, organizationId, externalUserId },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  findById(sessionId: string): Promise<AssistantSession | null> {
    return this.prisma.assistantSession.findUnique({
      where: { id: sessionId },
    });
  }

  create(data: CreateSessionData): Promise<AssistantSession> {
    return this.prisma.assistantSession.create({
      data: { ...data, history: [], metadata: {} },
    });
  }

  async appendMessage(sessionId: string, message: unknown): Promise<boolean> {
    const updated = await this.prisma.$executeRaw`
      UPDATE "AssistantSession"
      SET "history" = (CASE WHEN jsonb_typeof("history") = 'array' THEN "history" ELSE '[]'::jsonb END)
                      || ${JSON.stringify([message])}::jsonb,
          "lastMessageAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "id" = ${sessionId}`;
    return updated > 0;
  }

  async reset(sessionId: string): Promise<void> {
    await this.prisma.assistantSession.update({
      where: { id: sessionId },
      data: { history: [], lastMessageAt: null },
    });
  }

  async delete(sessionId: string): Promise<void> {
    await this.prisma.assistantSession.delete({ where: { id: sessionId } });
  }
}
