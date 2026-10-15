// chatia-backend/src/core/agents/repository/agents.repository.interface.ts
import type { Agent } from '@/core/agents/domain/agent.entity.js';

export const AGENTS_REPOSITORY = Symbol('AGENTS_REPOSITORY');

export interface UpsertAgentInput {
  firebaseUid: string;
  organizationId: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface UpdateAgentData {
  name?: string;
  avatarUrl?: string;
  isActive?: boolean;
  role?: string;
}

export interface IAgentsRepository {
  /** Crea el agente o actualiza sus datos de perfil. NUNCA cambia de organización a uno existente. */
  upsertByFirebaseUid(input: UpsertAgentInput): Promise<Agent>;
  findByFirebaseUid(
    firebaseUid: string,
    organizationId: string,
  ): Promise<Agent | null>;
  findInOrganization(id: string, organizationId: string): Promise<Agent | null>;
  listActive(organizationId: string): Promise<Agent[]>;
  /** Ids de agentes activos, del más antiguo al más nuevo (orden estable para round-robin). */
  listActiveIdsByCreation(organizationId: string): Promise<string[]>;
  update(
    id: string,
    organizationId: string,
    data: UpdateAgentData,
  ): Promise<Agent>;
}
