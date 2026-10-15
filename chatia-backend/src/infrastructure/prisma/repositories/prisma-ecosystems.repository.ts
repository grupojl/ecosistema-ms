// chatia-backend/src/infrastructure/prisma/repositories/prisma-ecosystems.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { Ecosystem, Prisma } from '@/generated/prisma/client.js';
import type {
  EcosystemSummary,
  IEcosystemsRepository,
} from '@/core/ecosystem/repository/ecosystems.repository.interface.js';

@Injectable()
export class PrismaEcosystemsRepository implements IEcosystemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Ecosystem | null> {
    return this.prisma.ecosystem.findUnique({ where: { id } });
  }

  findByFirebaseProjectId(
    firebaseProjectId: string,
  ): Promise<Ecosystem | null> {
    return this.prisma.ecosystem.findUnique({ where: { firebaseProjectId } });
  }

  create(input: {
    firebaseProjectId: string;
    name: string;
    config: Record<string, unknown>;
  }): Promise<Ecosystem> {
    return this.prisma.ecosystem.create({
      data: {
        firebaseProjectId: input.firebaseProjectId,
        name: input.name,
        config: input.config as Prisma.InputJsonObject,
      },
    });
  }

  listSummaries(): Promise<EcosystemSummary[]> {
    return this.prisma.ecosystem.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firebaseProjectId: true,
        name: true,
        isActive: true,
        config: true,
        createdAt: true,
        _count: { select: { organizations: true } },
      },
    });
  }

  updateConfig(
    id: string,
    config: Record<string, unknown>,
  ): Promise<Ecosystem> {
    return this.prisma.ecosystem.update({
      where: { id },
      data: { config: config as Prisma.InputJsonValue },
    });
  }

  async deactivate(id: string): Promise<void> {
    await this.prisma.ecosystem.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
