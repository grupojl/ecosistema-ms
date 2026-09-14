// chatia-backend/src/contacts/domain/contact.entity.ts
// ADR-011 Sprint 2 — Entidad de dominio Contact
// Sin imports de NestJS, Prisma ni Express — tipos TS puros

export type ContactChannel = 'WHATSAPP' | 'WIDGET' | 'EMAIL' | 'INSTAGRAM';

export interface Contact {
  readonly id:             string;
  readonly ecosystemId:    string;
  readonly organizationId: string;
  readonly phone:          string;
  readonly name:           string | null;
  readonly email:          string | null;
  readonly channel:        ContactChannel;
  readonly metadata:       Record<string, unknown>;
  readonly createdAt:      Date;
  readonly updatedAt:      Date;
}

/** Invariante: no pueden existir dos contactos con el mismo phone en la misma org */
export function assertNoDuplicatePhone(
  existing: Contact | null,
  phone: string,
  organizationId: string,
): void {
  if (existing) {
    throw new ContactAlreadyExistsError(phone, organizationId);
  }
}
