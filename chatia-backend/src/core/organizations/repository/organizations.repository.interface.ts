// chatia-backend/src/core/organizations/repository/organizations.repository.interface.ts
import type { Organization } from '@/generated/prisma/client.js';

export const ORGANIZATIONS_REPOSITORY = Symbol('ORGANIZATIONS_REPOSITORY');

export interface IOrganizationsRepository {
  findById(id: string): Promise<Organization | null>;
  /** Ecosistema dueño de la organización (null si no existe). */
  findOwnerEcosystemId(id: string): Promise<{ ecosystemId: string } | null>;
  findNameAndSlug(
    id: string,
  ): Promise<{ name: string; slug: string | null } | null>;
  /** Alta/refresco local de la organización (ecosistema 'dev' si se crea sin contexto). */
  ensureLocal(id: string, name: string, slug: string): Promise<void>;
  /** Upsert de la organización DENTRO de un ecosistema (el aislamiento se valida antes, en el service). */
  upsertForEcosystem(
    ecosystemId: string,
    id: string,
    name: string,
    slug?: string,
  ): Promise<Organization>;
}
