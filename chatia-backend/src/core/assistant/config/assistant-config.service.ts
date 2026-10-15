// src/core/assistant/config/assistant-config.service.ts
import { Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  ASSISTANT_CONFIG_REPOSITORY,
  type IAssistantConfigRepository,
} from '@/core/assistant/repository/assistant.repository.interface.js';
import {
  PROJECTS_REPOSITORY,
  type IProjectsRepository,
} from '@/core/projects/repository/projects.repository.interface.js';
import {
  ORGANIZATIONS_REPOSITORY,
  type IOrganizationsRepository,
} from '@/core/organizations/repository/organizations.repository.interface.js';
import type { UpdateAssistantConfigInput } from '@/core/assistant/schemas.js';

const DEFAULT_SYSTEM_PROMPT = `Sos un asistente virtual. Respondé de forma amigable, breve y en español.

Reglas:
- Nunca inventes información que no tenés
- Si no sabés algo, decilo claramente
- Sé empático y proactivo`;

@Injectable()
export class AssistantConfigService {
  private readonly logger = new Logger(AssistantConfigService.name);

  constructor(
    @Inject(ASSISTANT_CONFIG_REPOSITORY)
    private readonly configs: IAssistantConfigRepository,
    @Inject(PROJECTS_REPOSITORY)
    private readonly projects: IProjectsRepository,
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly organizations: IOrganizationsRepository,
  ) {}

  async getOrCreate(projectId: string, organizationId: string) {
    const existing = await this.configs.findByProjectId(projectId);
    if (existing) return existing;

    const created = await this.configs.create({
      projectId,
      organizationId,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    });
    this.logger.log(`AssistantConfig creado para proyecto ${projectId}`);
    return created;
  }

  async update(
    projectId: string,
    organizationId: string,
    dto: UpdateAssistantConfigInput,
  ) {
    await this.verifyOwnership(projectId, organizationId);
    return this.configs.update(projectId, dto);
  }

  async toggleEnabled(
    projectId: string,
    organizationId: string,
    enabled: boolean,
  ) {
    await this.verifyOwnership(projectId, organizationId);
    return this.configs.setEnabled(projectId, enabled);
  }

  async findByProjectSlug(slug: string, organizationId: string) {
    const project = await this.projects.findBySlugWithConfigs(
      organizationId,
      slug,
    );
    if (!project)
      throw new NotFoundException(`Proyecto "${slug}" no encontrado`);

    const config = project.assistantConfigs[0];
    if (!config) return this.getOrCreate(project.id, organizationId);
    return config;
  }

  /**
   * Config del proyecto por defecto de la org: primer proyecto activo (el más antiguo).
   * Si la org no tiene ninguno, crea uno con el slug de la organización.
   */
  async findDefaultForOrg(organizationId: string) {
    const existing =
      await this.projects.findDefaultActiveWithConfigs(organizationId);
    if (existing) {
      return (
        existing.assistantConfigs[0] ??
        this.getOrCreate(existing.id, organizationId)
      );
    }

    const org = await this.organizations.findNameAndSlug(organizationId);
    if (!org)
      throw new NotFoundException(
        `Organización "${organizationId}" no encontrada`,
      );

    const slug =
      (org.slug ?? organizationId)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'default';

    const project = await this.projects.upsertBySlug(
      organizationId,
      slug,
      org.name,
    );
    this.logger.log(
      `Proyecto por defecto "${slug}" creado para org ${organizationId}`,
    );
    return this.getOrCreate(project.id, organizationId);
  }

  private async verifyOwnership(projectId: string, organizationId: string) {
    const config = await this.configs.findOwned(projectId, organizationId);
    if (!config)
      throw new NotFoundException('Configuración de asistente no encontrada');
    return config;
  }
}
