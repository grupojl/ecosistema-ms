// chatia-backend/src/contacts/repository/prisma-contacts.repository.ts
// Adaptador concreto de IContactsRepository.
// ÚNICO archivo del módulo contacts que puede importar PrismaService.
// C5 fix: ecosystemId agregado al where de todas las queries (multi-tenant seguro)
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service.js";
import type {
  IContactsRepository,
  ContactRecord,
  ContactWithConversations,
  ListContactsFilter,
  ContactStats,
} from "@/contacts/repository/contacts.repository.interface.js";

@Injectable()
export class PrismaContactsRepository implements IContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    ecosystemId:    string,
    filters?:       ListContactsFilter,
  ): Promise<ContactRecord[]> {
    const where: Record<string, unknown> = { organizationId, ecosystemId };
    if (filters?.status) where["status"] = filters.status;
    if (filters?.search) {
      where["OR"] = [
        { name:     { contains: filters.search, mode: "insensitive" } },
        { phone:    { contains: filters.search } },
        { email:    { contains: filters.search, mode: "insensitive" } },
        { username: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const rows = await this.prisma.contact.findMany({
      where:   where as import("@prisma/client").Prisma.InputJsonValue,
      include: { _count: { select: { conversations: true } } },
      orderBy: { lastSeenAt: "desc" },
    });
    return rows as ContactRecord[];
  }

  async findOne(
    contactId:      string,
    organizationId: string,
    ecosystemId:    string,
  ): Promise<ContactWithConversations | null> {
    const row = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId, ecosystemId },
      include: {
        conversations: {
          orderBy: { createdAt: "desc" },
          take:    5,
          select:  {
            id: true, status: true, stage: true,
            lastMessageAt: true, createdAt: true,
          },
        },
      },
    });
    return row as ContactWithConversations | null;
  }

  async update(
    contactId:      string,
    organizationId: string,
    ecosystemId:    string,
    patch: { name?: string; email?: string; status?: string; tags?: string[]; optedOut?: boolean },
  ): Promise<ContactRecord> {
    // Verificar ownership antes de actualizar (ecosystemId + organizationId)
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, organizationId, ecosystemId },
      select: { id: true },
    });
    if (!existing) throw new Error(`Contact ${contactId} not found in org ${organizationId}`);

    const row = await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ...(patch.name     !== undefined && { name:     patch.name }),
        ...(patch.email    !== undefined && { email:    patch.email }),
        ...(patch.status   !== undefined && { status:   patch.status as import("@prisma/client").Prisma.InputJsonValue }),
        ...(patch.tags     !== undefined && { tags:     patch.tags }),
        ...(patch.optedOut !== undefined && { optedOut: patch.optedOut }),
      },
    });
    return row as ContactRecord;
  }

  async getStats(organizationId: string, ecosystemId: string): Promise<ContactStats> {
    const [total, byStatus, optedOut] = await Promise.all([
      this.prisma.contact.count({ where: { organizationId, ecosystemId } }),
      this.prisma.contact.groupBy({
        by:    ["status"],
        where: { organizationId, ecosystemId },
        _count: true,
      }),
      this.prisma.contact.count({ where: { organizationId, ecosystemId, optedOut: true } }),
    ]);
    return {
      total,
      optedOut,
      byStatus: byStatus.reduce(
        (acc, row) => ({ ...acc, [row.status]: row._count }),
        {} as Record<string, number>,
      ),
    };
  }
}
