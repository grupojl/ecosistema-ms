// chatia-backend/src/core/contacts/domain/contact.errors.ts
// ADR-011 Sprint 2 — Errores de dominio tipados (sin imports de NestJS)

export class ContactAlreadyExistsError extends Error {
  constructor(phone: string, organizationId: string) {
    super(`Contact with phone ${phone} already exists in org ${organizationId}`);
    this.name = 'ContactAlreadyExistsError';
  }
}

export class ContactNotFoundError extends Error {
  constructor(id: string, organizationId?: string) {
    super(organizationId
      ? `Contact ${id} not found in org ${organizationId}`
      : `Contact ${id} not found`);
    this.name = 'ContactNotFoundError';
  }
}

export class ContactInvalidTagsError extends Error {
  constructor(duplicates: string[]) {
    super(`Tags duplicados: ${duplicates.join(', ')}`);
    this.name = 'ContactInvalidTagsError';
  }
}
