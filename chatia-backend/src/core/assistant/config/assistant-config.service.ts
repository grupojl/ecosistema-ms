// src/assistant/config/assistant-config.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type { UpdateAssistantConfigInput } from '@/core/assistant/schemas.js';

const DEFAULT_SYSTEM_PROMPT = `Sos un asistente virtual. Respondé de forma amigable, breve y en español.

Reglas:
- Nunca inventes información que no tenés
- Si no sabés algo, decilo claramente
- Sé empático y proactivo`;

@Injectable()
export class AssistantConfigService {
  private readonly logger = new Logger(AssistantConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(projectId: string, organizationId: string) {
    const existing = await this.prisma.assistantConfig.findUnique({
      where: { projectId },
    });
    if (existing) return existing;

    const created = await this.prisma.assistantConfig.create({
      data: { projectId, organizationId, systemPrompt: DEFAULT_SYSTEM_PROMPT },
    });
    this.logger.log(`AssistantConfig creado para proyecto ${projectId}`);
    return created;
  }

  async update(projectId: string, organizationId: string, dto: UpdateAssistantConfigInput) {
    await this.verifyOwnership(projectId, organizationId);
    return this.prisma.assistantConfig.update({ where: { projectId }, data: dto });
  }

  async toggleEnabled(projectId: string, organizationId: string, enabled: boolean) {
    await this.verifyOwnership(projectId, organizationId);
    return this.prisma.assistantConfig.update({
      where: { projectId },
      data: { isEnabled: enabled },
    });
  }

  async findByProjectSlug(slug: string, organizationId: string) {
    const project = await this.prisma.project.findUnique({
      where: { organizationId_slug: { organizationId, slug } },
      include: { assistantConfigs: true },
    });
    if (!project) throw new NotFoundException(`Proyecto "${slug}" no encontrado`);

    const config = project.assistantConfigs[0];
    if (!config) return this.getOrCreate(project.id, organizationId);
    return config;
  }

  /**
   * Config del proyecto por defecto de la org: primer proyecto activo (el más antiguo).
   * Si la org no tiene ninguno, crea uno con el slug de la organización.
   */
  async findDefaultForOrg(organizationId: string) {
    const existing = await this.prisma.project.findFirst({
      where:   { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
      include: { assistantConfigs: true },
    });
    if (existing) {
      return existing.assistantConfigs[0] ?? this.getOrCreate(existing.id, organizationId);
    }

    const org = await this.prisma.organization.findUnique({
      where:  { id: organizationId },
      select: { name: true, slug: true },
    });
    if (!org) throw new NotFoundException(`Organización "${organizationId}" no encontrada`);

    const slug = (org.slug ?? organizationId)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'default';

    // upsert: tolera dos primeros chats concurrentes de la misma org
    const project = await this.prisma.project.upsert({
      where:  { organizationId_slug: { organizationId, slug } },
      update: {},
      create: { organizationId, slug, name: org.name },
    });
    this.logger.log(`Proyecto por defecto "${slug}" creado para org ${organizationId}`);
    return this.getOrCreate(project.id, organizationId);
  }

  private async verifyOwnership(projectId: string, organizationId: string) {
    const config = await this.prisma.assistantConfig.findFirst({
      where: { projectId, organizationId },
    });
    if (!config) throw new NotFoundException('Configuración de asistente no encontrada');
    return config;
  }
}
