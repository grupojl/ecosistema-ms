// chatia-backend/src/contacts/domain/contact.errors.ts
// ADR-011 Sprint 2 — Errores de dominio tipados

export class ContactAlreadyExistsError extends Error {
  constructor(phone: string, organizationId: string) {
    super(`Contact with phone ${phone} already exists in org ${organizationId}`);
    this.name = 'ContactAlreadyExistsError';
  }
}

export class ContactNotFoundError extends Error {
  constructor(id: string) {
    super(`Contact ${id} not found`);
    this.name = 'ContactNotFoundError';
  }
}
