// chatia-backend/src/infrastructure/prisma/repositories/prisma-agents.repository.ts
// Único archivo de agents que conoce Prisma.
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { Agent } from '@/core/agents/domain/agent.entity.js';
import type {
  IAgentsRepository,
  UpdateAgentData,
  UpsertAgentInput,
} from '@/core/agents/repository/agents.repository.interface.js';

@Injectable()
export class PrismaAgentsRepository implements IAgentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertByFirebaseUid(input: UpsertAgentInput): Promise<Agent> {
    return this.prisma.agent.upsert({
      where: { firebaseUid: input.firebaseUid },
      // un agente existente conserva su organización: el upsert solo refresca el perfil
      update: {
        name: input.name,
        email: input.email,
        avatarUrl: input.avatarUrl,
      },
      create: {
        id: randomUUID(),
        firebaseUid: input.firebaseUid,
        organizationId: input.organizationId,
        name: input.name,
        email: input.email,
        avatarUrl: input.avatarUrl,
      },
    });
  }

  findByFirebaseUid(
    firebaseUid: string,
    organizationId: string,
  ): Promise<Agent | null> {
    return this.prisma.agent.findFirst({
      where: { firebaseUid, organizationId },
    });
  }

  findInOrganization(
    id: string,
    organizationId: string,
  ): Promise<Agent | null> {
    return this.prisma.agent.findFirst({ where: { id, organizationId } });
  }

  listActive(organizationId: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async listActiveIdsByCreation(organizationId: string): Promise<string[]> {
    const rows = await this.prisma.agent.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((a) => a.id);
  }

  update(
    id: string,
    organizationId: string,
    data: UpdateAgentData,
  ): Promise<Agent> {
    return this.prisma.agent.update({ where: { id, organizationId }, data });
  }
}
