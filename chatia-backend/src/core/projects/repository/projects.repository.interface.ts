// chatia-backend/src/core/projects/repository/projects.repository.interface.ts
import type { AssistantConfig, Project } from '@/generated/prisma/client.js';

export const PROJECTS_REPOSITORY = Symbol('PROJECTS_REPOSITORY');

export type ProjectWithConfigs = Project & {
  assistantConfigs: AssistantConfig[];
};

export type ProjectListItem = Project & {
  _count: { assistantConfigs: number; knowledgeBases: number };
};

export interface ProjectDetail extends Project {
  assistantConfigs: Array<
    Pick<AssistantConfig, 'id' | 'personaName' | 'isEnabled' | 'groqModel'>
  >;
  knowledgeBases: Array<{ id: string; name: string; isActive: boolean }>;
}

/** Proyecto + configs + ecosistema de su organización (para el widget público). */
export type PublicProject = ProjectWithConfigs & {
  organization: { ecosystemId: string };
};

export interface CreateProjectData {
  organizationId: string;
  slug: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export type UpdateProjectData = Partial<
  Omit<CreateProjectData, 'organizationId'>
>;

export interface IProjectsRepository {
  findBySlug(organizationId: string, slug: string): Promise<Project | null>;
  findDetailedBySlug(
    organizationId: string,
    slug: string,
  ): Promise<ProjectDetail | null>;
  findByIdInOrganization(
    id: string,
    organizationId: string,
  ): Promise<Project | null>;
  listWithCounts(organizationId: string): Promise<ProjectListItem[]>;
  create(data: CreateProjectData): Promise<Project>;
  update(
    organizationId: string,
    slug: string,
    data: UpdateProjectData,
  ): Promise<Project>;
  remove(organizationId: string, slug: string): Promise<void>;
  findBySlugWithConfigs(
    organizationId: string,
    slug: string,
  ): Promise<ProjectWithConfigs | null>;
  /** Primer proyecto activo (el más antiguo) de la organización. */
  findDefaultActiveWithConfigs(
    organizationId: string,
  ): Promise<ProjectWithConfigs | null>;
  upsertBySlug(
    organizationId: string,
    slug: string,
    name: string,
  ): Promise<Project>;
  /** Proyectos activos con ese slug (el slug es único solo dentro de una organización): máx. 2 para detectar ambigüedad. */
  findActiveBySlugForWidget(
    slug: string,
    organizationId?: string,
  ): Promise<PublicProject[]>;
}
