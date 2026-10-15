// chatia-backend/src/core/privacy/repository/privacy.repository.interface.ts
export const PRIVACY_REPOSITORY = Symbol('PRIVACY_REPOSITORY');

export interface ContactIdentity {
  id: string;
  externalId: string;
}

export interface ErasedCounts {
  conversationsDeleted: number;
  messagesDeleted: number;
  sessionsDeleted: number;
}

export interface IPrivacyRepository {
  /** Borra sesiones del asistente inactivas desde antes de `cutoff`, por lotes. Devuelve cuántas. */
  deleteSessionsOlderThan(cutoff: Date, batchSize: number): Promise<number>;
  /** Borra mensajes anteriores a `cutoff`, por lotes. Devuelve cuántos. */
  deleteMessagesOlderThan(cutoff: Date, batchSize: number): Promise<number>;
  /** El contacto, solo si es de la organización. */
  findContact(
    organizationId: string,
    contactId: string,
  ): Promise<ContactIdentity | null>;
  /**
   * Derecho de supresión: elimina el contacto y todo lo que cuelga de él (conversaciones, mensajes, notificaciones,
   * estados de agente y sesiones del asistente) en UNA transacción. Irreversible.
   */
  eraseContact(
    organizationId: string,
    contact: ContactIdentity,
  ): Promise<ErasedCounts>;
}
