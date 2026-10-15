// chatia-backend/src/core/projects/projects.service.ts
import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  PROJECTS_REPOSITORY,
  type IProjectsRepository,
} from '@/core/projects/repository/projects.repository.interface.js';
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from '@/core/projects/schemas.js';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(PROJECTS_REPOSITORY) private readonly repo: IProjectsRepository,
  ) {}

  async create(organizationId: string, dto: CreateProjectInput) {
    // Generar slug desde name si no viene en el DTO
    const slug =
      dto.slug ??
      dto.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 60);

    const existing = await this.repo.findBySlug(organizationId, slug);
    if (existing) {
      throw new ConflictException(
        `Ya existe un proyecto con el slug "${slug}"`,
      );
    }

    const project = await this.repo.create({
      ...dto,
      slug,
      organizationId,
    });
    this.logger.log(`Proyecto creado: ${project.id} (${project.slug})`);
    return { success: true, data: project };
  }

  async findAll(organizationId: string) {
    const projects = await this.repo.listWithCounts(organizationId);
    return { success: true, data: projects };
  }

  async findOne(slug: string, organizationId: string) {
    const project = await this.repo.findDetailedBySlug(organizationId, slug);
    if (!project)
      throw new NotFoundException(`Proyecto "${slug}" no encontrado`);
    return { success: true, data: project };
  }

  async findOneById(id: string, organizationId: string) {
    const project = await this.repo.findByIdInOrganization(id, organizationId);
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async update(slug: string, organizationId: string, dto: UpdateProjectInput) {
    await this.findOne(slug, organizationId);
    if (dto.slug && dto.slug !== slug) {
      const conflict = await this.repo.findBySlug(organizationId, dto.slug);
      if (conflict) {
        throw new ConflictException(
          `Ya existe un proyecto con el slug "${dto.slug}"`,
        );
      }
    }
    const updated = await this.repo.update(organizationId, slug, dto);
    return { success: true, data: updated };
  }

  async remove(slug: string, organizationId: string) {
    await this.findOne(slug, organizationId);
    await this.repo.remove(organizationId, slug);
    return { success: true, message: `Proyecto "${slug}" eliminado` };
  }
}
