// chatia-backend/src/conversations/domain/conversation.entity.ts
//
// Entidad de dominio pura — sin imports de NestJS ni Prisma.
// Es el MOLDE VIVO de ecosistema-ms: todos los demás módulos siguen esta estructura.
//
// Invariantes de dominio:
//   - Una conversación CLOSED no puede volver a OPEN
//   - Solo la conversación OPEN puede transicionar a ASSIGNED o HUMAN_TAKEOVER
//   - El soft-delete (deletedAt) no elimina mensajes — solo marca la conversación
//   - Los tags son un set — no se pueden duplicar

export type ConversationStatus =
  | 'OPEN'
  | 'ASSIGNED'
  | 'HUMAN_TAKEOVER'
  | 'RESOLVED'
  | 'CLOSED';

export type ConversationStage =
  | 'INITIAL'
  | 'QUALIFYING'
  | 'INTERESTED'
  | 'NEGOTIATING'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

export interface Conversation {
  readonly id:               string;
  readonly channelAccountId: string;
  readonly contactId:        string;
  readonly organizationId:   string;   // desnormalizado para queries directas
  readonly status:           ConversationStatus;
  readonly stage:            ConversationStage;
  readonly isAiActive:       boolean;
  readonly assignedAgentId:  string | null;
  readonly detectedIntent:   string | null;
  readonly extractedEntities: Record<string, string>;
  readonly summary:          string | null;
  readonly tags:             readonly string[];
  readonly lastMessageAt:    Date | null;
  readonly resolvedAt:       Date | null;
  readonly deletedAt:        Date | null;
  readonly createdAt:        Date;
  readonly updatedAt:        Date;
}

// ── Transiciones válidas (invariantes de dominio) ─────────────────────────────

const VALID_TRANSITIONS: Record<ConversationStatus, ConversationStatus[]> = {
  OPEN:            ['ASSIGNED', 'HUMAN_TAKEOVER', 'RESOLVED'],
  ASSIGNED:        ['OPEN', 'HUMAN_TAKEOVER', 'RESOLVED'],
  HUMAN_TAKEOVER:  ['OPEN', 'ASSIGNED', 'RESOLVED'],
  RESOLVED:        ['OPEN'],
  CLOSED:          [],   // CLOSED es terminal
};

export function assertValidTransition(
  from: ConversationStatus,
  to:   ConversationStatus,
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new ConversationTransitionError(from, to);
  }
}

export function addTag(
  conversation: Conversation,
  tag: string,
): string[] {
  const normalized = tag.trim().toLowerCase();
  if (conversation.tags.includes(normalized)) return [...conversation.tags];
  return [...conversation.tags, normalized];
}

export function removeTag(
  conversation: Conversation,
  tag: string,
): string[] {
  const normalized = tag.trim().toLowerCase();
  return conversation.tags.filter((t) => t !== normalized);
}
