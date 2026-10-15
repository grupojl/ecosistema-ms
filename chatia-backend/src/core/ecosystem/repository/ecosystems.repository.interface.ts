// chatia-backend/src/core/ecosystem/repository/ecosystems.repository.interface.ts
import type { Ecosystem } from '@/generated/prisma/client.js';

export const ECOSYSTEMS_REPOSITORY = Symbol('ECOSYSTEMS_REPOSITORY');

export interface EcosystemSummary {
  id: string;
  firebaseProjectId: string;
  name: string;
  isActive: boolean;
  config: unknown;
  createdAt: Date;
  _count: { organizations: number };
}

export interface IEcosystemsRepository {
  findById(id: string): Promise<Ecosystem | null>;
  findByFirebaseProjectId(firebaseProjectId: string): Promise<Ecosystem | null>;
  create(input: {
    firebaseProjectId: string;
    name: string;
    config: Record<string, unknown>;
  }): Promise<Ecosystem>;
  listSummaries(): Promise<EcosystemSummary[]>;
  updateConfig(id: string, config: Record<string, unknown>): Promise<Ecosystem>;
  deactivate(id: string): Promise<void>;
}
