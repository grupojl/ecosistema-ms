// chatia-backend/src/contacts/repository/contacts.repository.interface.ts
// ADR-011 Sprint 2 — Puerto del repositorio de contactos

import type { Contact } from '../domain/contact.entity.js';

export const CONTACTS_REPOSITORY = Symbol('CONTACTS_REPOSITORY');

export interface IContactsRepository {
  findById(id: string, organizationId: string, ecosystemId: string): Promise<Contact | null>;
  findByPhone(phone: string, organizationId: string, ecosystemId: string): Promise<Contact | null>;
  list(params: {
    organizationId: string;
    ecosystemId:    string;
    page?:          number;
    limit?:         number;
    search?:        string;
  }): Promise<{ data: Contact[]; total: number }>;
  create(input: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact>;
  update(id: string, organizationId: string, data: Partial<Pick<Contact, 'name' | 'email' | 'metadata'>>): Promise<Contact>;
}
