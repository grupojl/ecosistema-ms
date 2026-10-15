// chatia-backend/src/core/agents/domain/agent.entity.ts
// Entidad de dominio pura — sin imports de NestJS ni Prisma. Refleja el modelo Agent real.
import {
  AgentForbiddenError,
  AgentIdentityMismatchError,
} from '@/core/agents/domain/agent.errors.js';

export type AgentRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Agent {
  readonly id: string;
  readonly organizationId: string;
  readonly firebaseUid: string;
  readonly name: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly role: string;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Campos que solo un OWNER/ADMIN puede cambiar (afectan la asignación y los permisos). */
const ADMIN_ONLY_FIELDS = ['isActive', 'role'] as const;

const isAdmin = (role: string): boolean => role === 'OWNER' || role === 'ADMIN';

/**
 * Invariante: un miembro solo edita SU PROPIO perfil (nombre/avatar). Activar/desactivar agentes o cambiar
 * roles, y editar a otros, es de OWNER/ADMIN.
 */
export function assertCanUpdateAgent(
  actor: { role: string; firebaseUid: string },
  target: { firebaseUid: string },
  changedFields: readonly string[],
): void {
  if (isAdmin(actor.role)) return;
  if (actor.firebaseUid !== target.firebaseUid) {
    throw new AgentForbiddenError(
      'Solo un OWNER/ADMIN puede editar a otros agentes',
    );
  }
  const restricted = changedFields.filter((f) =>
    (ADMIN_ONLY_FIELDS as readonly string[]).includes(f),
  );
  if (restricted.length > 0) {
    throw new AgentForbiddenError(
      `Solo un OWNER/ADMIN puede cambiar: ${restricted.join(', ')}`,
    );
  }
}

/** El registro se hace con la identidad del TOKEN: el body no puede apuntar a otro usuario u organización. */
export function assertRegistrationMatchesToken(
  token: { firebaseUid: string; organizationId: string },
  body: { firebaseUid: string; organizationId?: string },
): void {
  if (body.firebaseUid !== token.firebaseUid)
    throw new AgentIdentityMismatchError('firebaseUid');
  if (body.organizationId && body.organizationId !== token.organizationId)
    throw new AgentIdentityMismatchError('organizationId');
}
