// src/common/types/tenant-context.ts
//
// Contexto del tenant resuelto por TenantGuard en cada request autenticado.
// Disponible via @Tenant() decorator en todos los controllers.
//
// BREAKING CHANGE (ADR-001 Sprint 0):
//   roles: string[]  →  role: TenantRole  (un solo rol por sesión, del claim Firebase)
//   ecosystemId agregado (id del Ecosystem registrado en chat-ia-back)
//
// Migrar usos de tenant.roles:
//   tenant.roles.includes('admin')  →  tenant.role === 'OWNER' || tenant.role === 'ADMIN'
import type { TenantRole } from '../schemas/tenant-claims.schema';

export interface TenantContext {
  // ── Plataforma ──────────────────────────────────────────────────────────────
  ecosystemId: string;          // id del Ecosystem local (Sprint 1)

  // ── Organización ────────────────────────────────────────────────────────────
  organizationId:   string;
  organizationName: string;

  // ── Usuario ─────────────────────────────────────────────────────────────────
  firebaseUid: string;
  email:       string;
  name:        string;

  // ── Autorización ─────────────────────────────────────────────────────────────
  role:     TenantRole;
  canRead:  boolean;
  canWrite: boolean;

  // agentId opcional — lo upsertea el TenantGuard reescrito en Sprint 2
  agentId?: string;
}
