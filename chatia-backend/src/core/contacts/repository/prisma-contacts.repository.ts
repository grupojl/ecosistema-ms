// chatia-backend/src/core/contacts/repository/prisma-contacts.repository.ts
// Adaptador concreto de IContactsRepository.
// ÚNICO archivo del módulo contacts que puede importar PrismaService.
// Multi-tenant: organizationId + organization.ecosystemId en el where de todas las queries.
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type {
  IContactsRepository,
  ContactRecord,
  ContactWithConversations,
  ListContactsFilter,
  ContactStats,
  UpdateContactPatch,
} from '@/core/contacts/repository/contacts.repository.interface.js';

@Injectable()
export class PrismaContactsRepository implements IContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private scope(organizationId: string, ecosystemId: string): Prisma.ContactWhereInput {
    return { organizationId, organization: { ecosystemId } };
  }

  async list(
    organizationId: string,
    ecosystemId:    string,
    filters:        ListContactsFilter = {},
  ): Promise<{ data: ContactRecord[]; total: number; page: number; limit: number }> {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;

    const where: Prisma.ContactWhereInput = {
      ...this.scope(organizationId, ecosystemId),
      ...(filters.status                 ? { status: filters.status }         : {}),
      ...(filters.optedOut !== undefined ? { optedOut: filters.optedOut }     : {}),
      ...(filters.tag                    ? { tags: { has: filters.tag } }     : {}),
      ...(filters.search ? {
        OR: [
          { name:     { contains: filters.search, mode: 'insensitive' } },
          { phone:    { contains: filters.search } },
          { email:    { contains: filters.search, mode: 'insensitive' } },
          { username: { contains: filters.search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        include: { _count: { select: { conversations: true } } },
        orderBy: { lastSeenAt: 'desc' },
        take:    limit,
        skip:    (page - 1) * limit,
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  findOne(
    contactId:      string,
    organizationId: string,
    ecosystemId:    string,
  ): Promise<ContactWithConversations | null> {
    return this.prisma.contact.findFirst({
      where: { id: contactId, ...this.scope(organizationId, ecosystemId) },
      include: {
        conversations: {
          orderBy: { createdAt: 'desc' },
          take:    5,
          select:  { id: true, status: true, stage: true, lastMessageAt: true, createdAt: true },
        },
      },
    });
  }

  async update(
    contactId:      string,
    organizationId: string,
    ecosystemId:    string,
    patch:          UpdateContactPatch,
  ): Promise<ContactRecord | null> {
    // Verificar ownership antes de actualizar (ecosystemId + organizationId)
    const existing = await this.prisma.contact.findFirst({
      where:  { id: contactId, ...this.scope(organizationId, ecosystemId) },
      select: { id: true },
    });
    if (!existing) return null;

    const { metadata, ...rest } = patch;
    return this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonObject } : {}),
      },
      include: { _count: { select: { conversations: true } } },
    });
  }

  async getStats(organizationId: string, ecosystemId: string): Promise<ContactStats> {
    const where = this.scope(organizationId, ecosystemId);
    const [total, byStatus, optedOut] = await Promise.all([
      this.prisma.contact.count({ where }),
      this.prisma.contact.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.contact.count({ where: { ...where, optedOut: true } }),
    ]);
    return {
      total,
      optedOut,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
    };
  }
}
