// chatia-backend/src/infrastructure/prisma/repositories/prisma-organizations.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { Organization } from '@/generated/prisma/client.js';
import type { IOrganizationsRepository } from '@/core/organizations/repository/organizations.repository.interface.js';

@Injectable()
export class PrismaOrganizationsRepository implements IOrganizationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({ where: { id } });
  }

  findOwnerEcosystemId(id: string): Promise<{ ecosystemId: string } | null> {
    return this.prisma.organization.findUnique({
      where: { id },
      select: { ecosystemId: true },
    });
  }

  findNameAndSlug(
    id: string,
  ): Promise<{ name: string; slug: string | null } | null> {
    return this.prisma.organization.findUnique({
      where: { id },
      select: { name: true, slug: true },
    });
  }

  async ensureLocal(id: string, name: string, slug: string): Promise<void> {
    await this.prisma.organization.upsert({
      where: { id },
      create: { id, ecosystemId: 'dev', name, slug, isActive: true },
      update: { name, slug },
    });
  }

  upsertForEcosystem(
    ecosystemId: string,
    id: string,
    name: string,
    slug?: string,
  ): Promise<Organization> {
    return this.prisma.organization.upsert({
      where: { id },
      update: { name, ...(slug ? { slug } : {}) },
      create: { id, ecosystemId, name, ...(slug ? { slug } : {}) },
    });
  }
}
