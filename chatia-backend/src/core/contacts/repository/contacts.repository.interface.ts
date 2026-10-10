// chatia-backend/src/core/contacts/repository/contacts.repository.interface.ts
// ADR-011 Sprint 2 — Puerto del repositorio de contactos.
// Multi-tenancy: todas las operaciones filtran por organizationId + ecosystemId
// (Contact no tiene ecosystemId propio: se resuelve por Organization.ecosystemId).
import type { ContactStatus, Prisma } from '@/generated/prisma/client.js';

export const CONTACTS_REPOSITORY = Symbol('CONTACTS_REPOSITORY');

export type ContactRecord = Prisma.ContactGetPayload<{
  include: { _count: { select: { conversations: true } } };
}>;

export type ContactWithConversations = Prisma.ContactGetPayload<{
  include: {
    conversations: {
      select: { id: true; status: true; stage: true; lastMessageAt: true; createdAt: true };
    };
  };
}>;

export interface ListContactsFilter {
  status?:   ContactStatus;
  search?:   string;
  optedOut?: boolean;
  tag?:      string;
  page?:     number;
  limit?:    number;
}

export interface UpdateContactPatch {
  name?:      string;
  email?:     string;
  phone?:     string;
  username?:  string;
  avatarUrl?: string;
  status?:    ContactStatus;
  optedOut?:  boolean;
  tags?:      string[];
  metadata?:  Record<string, unknown>;
}

export interface ContactStats {
  total:    number;
  optedOut: number;
  byStatus: Record<string, number>;
}

export interface IContactsRepository {
  list(
    organizationId: string,
    ecosystemId:    string,
    filters?:       ListContactsFilter,
  ): Promise<{ data: ContactRecord[]; total: number; page: number; limit: number }>;

  findOne(
    contactId:      string,
    organizationId: string,
    ecosystemId:    string,
  ): Promise<ContactWithConversations | null>;

  /** Devuelve null si el contacto no existe en la org/ecosistema. */
  update(
    contactId:      string,
    organizationId: string,
    ecosystemId:    string,
    patch:          UpdateContactPatch,
  ): Promise<ContactRecord | null>;

  getStats(organizationId: string, ecosystemId: string): Promise<ContactStats>;
}
