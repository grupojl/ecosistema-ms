// src/core/organizations/organizations.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ORGANIZATIONS_REPOSITORY,
  type IOrganizationsRepository,
} from '@/core/organizations/repository/organizations.repository.interface.js';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly repo: IOrganizationsRepository,
  ) {}

  /**
   * Garantiza que la organización existe localmente.
   * Se llama en cada request desde TenantGuard — debe ser muy rápida.
   * Si la org ya existe y no cambió, no genera ninguna query de escritura.
   */
  async ensureExists(id: string, name: string, slug: string): Promise<void> {
    try {
      await this.repo.ensureLocal(id, name, slug); // actualiza nombre/slug si cambiaron en el dashboard
    } catch (err) {
      // Nunca debe romper el flujo principal
      this.logger.warn(`No se pudo upsert Organization ${id}: ${String(err)}`);
    }
  }

  async findOne(id: string) {
    return this.repo.findById(id);
  }
}
