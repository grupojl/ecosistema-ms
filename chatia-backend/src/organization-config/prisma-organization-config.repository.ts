// chatia-backend/src/organization-config/prisma-organization-config.repository.ts
// ÚNICO lugar con PrismaService en este módulo.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  IOrganizationConfigRepository,
  StoredOrgConfig,
  UpsertOrgConfigInput,
} from './organization-config.repository.interface.js';

@Injectable()
export class PrismaOrganizationConfigRepository implements IOrganizationConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrgId(ecosystemId: string, organizationId: string): Promise<StoredOrgConfig | null> {
    const row = await this.prisma.organizationConfig.findUnique({
      where: { ecosystemId_organizationId: { ecosystemId, organizationId } },
    });
    return row ? this.toRecord(row) : null;
  }

  async upsert(input: UpsertOrgConfigInput): Promise<StoredOrgConfig> {
    const row = await this.prisma.organizationConfig.upsert({
      where: { ecosystemId_organizationId: { ecosystemId: input.ecosystemId, organizationId: input.organizationId } },
      update: {
        ...(input.plan         && { plan: input.plan }),
        ...(input.featureFlags && { featureFlags: input.featureFlags as Prisma.InputJsonObject // @ecosistema-ms/jsonb-cast }),
        ...(input.limits       && { limits: input.limits as Prisma.InputJsonObject // @ecosistema-ms/jsonb-cast }),
        ...(input.timezone     && { timezone: input.timezone }),
        ...(input.locale       && { locale: input.locale }),
      },
      create: {
        ecosystemId:    input.ecosystemId,
        organizationId: input.organizationId,
        plan:           input.plan      ?? 'starter',
        featureFlags:   (input.featureFlags ?? {}) as Prisma.InputJsonObject // @ecosistema-ms/jsonb-cast,
        limits:         (input.limits       ?? {}) as Prisma.InputJsonObject // @ecosistema-ms/jsonb-cast,
        timezone:       input.timezone  ?? 'America/Buenos_Aires',
        locale:         input.locale    ?? 'es',
      },
    });
    return this.toRecord(row);
  }

  async findAllByEcosystem(ecosystemId: string): Promise<StoredOrgConfig[]> {
    const rows = await this.prisma.organizationConfig.findMany({
      where: { ecosystemId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map(r => this.toRecord(r));
  }

  private toRecord(row: {
    id: string; organizationId: string; ecosystemId: string; plan: string;
    featureFlags: unknown; limits: unknown; timezone: string; locale: string;
    updatedAt: Date; createdAt: Date;
  }): StoredOrgConfig {
    return {
      id:              row.id,
      organizationId:  row.organizationId,
      ecosystemId:     row.ecosystemId,
      plan:            row.plan as StoredOrgConfig['plan'],
      featureFlags:    (row.featureFlags as Record<string, boolean>) ?? {}, // @grupojl/jsonb
      limits:          (row.limits as Record<string, number>)       ?? {}, // @grupojl/jsonb
      timezone:        row.timezone,
      locale:          row.locale,
      updatedAt:       row.updatedAt,
      createdAt:       row.createdAt,
    };
  }
}
