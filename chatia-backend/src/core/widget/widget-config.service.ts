// src/core/widget/widget-config.service.ts
// Resolución de la configuración PÚBLICA del asistente para el widget embebible (sin auth).
// Antes vivía en el controller con acceso directo a Prisma.
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PROJECTS_REPOSITORY,
  type IProjectsRepository,
} from '@/core/projects/repository/projects.repository.interface.js';

@Injectable()
export class WidgetConfigService {
  constructor(
    @Inject(PROJECTS_REPOSITORY) private readonly projects: IProjectsRepository,
  ) {}

  /** El slug es único solo dentro de una organización: si es ambiguo se exige `?org=`. */
  async resolve(slug: string, organizationId?: string) {
    const found = await this.projects.findActiveBySlugForWidget(
      slug,
      organizationId,
    );
    if (found.length === 0)
      throw new NotFoundException('Proyecto no encontrado');
    if (found.length > 1) {
      throw new ConflictException(
        `El proyecto "${slug}" existe en más de una organización: indicá ?org=`,
      );
    }
    const project = found[0];
    const config = project.assistantConfigs[0];
    if (!config)
      throw new NotFoundException(
        'Este proyecto no tiene asistente configurado',
      );
    if (!config.isEnabled)
      throw new NotFoundException('El asistente no está disponible');
    return {
      ...config,
      projectId: project.id,
      ecosystemId: project.organization.ecosystemId,
    };
  }
}
