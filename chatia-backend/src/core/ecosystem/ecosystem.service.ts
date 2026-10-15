// src/core/ecosystem/ecosystem.service.ts
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ECOSYSTEMS_REPOSITORY,
  type IEcosystemsRepository,
} from '@/core/ecosystem/repository/ecosystems.repository.interface.js';
import {
  ORGANIZATIONS_REPOSITORY,
  type IOrganizationsRepository,
} from '@/core/organizations/repository/organizations.repository.interface.js';
import type { RegisterEcosystemInput } from '@/core/ecosystem/schemas.js';

@Injectable()
export class EcosystemService {
  private readonly logger = new Logger(EcosystemService.name);

  constructor(
    @Inject(ECOSYSTEMS_REPOSITORY)
    private readonly ecosystems: IEcosystemsRepository,
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly organizations: IOrganizationsRepository,
  ) {}

  // ── Registro de ecosistema nuevo ─────────────────────────────────────────
  async register(dto: RegisterEcosystemInput) {
    const existing = await this.ecosystems.findByFirebaseProjectId(
      dto.firebaseProjectId,
    );
    if (existing) {
      throw new ConflictException(
        `Ya existe un ecosistema con firebaseProjectId: ${dto.firebaseProjectId}`,
      );
    }
    const ecosystem = await this.ecosystems.create({
      firebaseProjectId: dto.firebaseProjectId,
      name: dto.name,
      config: dto.config,
    });
    this.logger.log(
      `Ecosistema registrado: ${ecosystem.name} (${ecosystem.id})`,
    );
    return { success: true, data: ecosystem };
  }

  // ── Resolución por firebaseProjectId ─────────────────────────────────────
  // Llamado en cada request desde TenantGuard (Sprint 2)
  async resolveByFirebaseProjectId(firebaseProjectId: string) {
    return this.ecosystems.findByFirebaseProjectId(firebaseProjectId);
  }

  // ── Listar todos ──────────────────────────────────────────────────────────
  async findAll() {
    return this.ecosystems.listSummaries();
  }

  // ── Actualizar config ─────────────────────────────────────────────────────
  async updateConfig(id: string, config: Record<string, unknown>) {
    const ecosystem = await this.ecosystems.findById(id);
    if (!ecosystem)
      throw new NotFoundException(`Ecosistema ${id} no encontrado`);
    return this.ecosystems.updateConfig(id, config);
  }

  // ── Desactivar ────────────────────────────────────────────────────────────
  async deactivate(id: string) {
    const ecosystem = await this.ecosystems.findById(id);
    if (!ecosystem)
      throw new NotFoundException(`Ecosistema ${id} no encontrado`);
    await this.ecosystems.deactivate(id);
    this.logger.warn(`Ecosistema desactivado: ${ecosystem.name} (${id})`);
    return {
      success: true,
      message: `Ecosistema ${ecosystem.name} desactivado`,
    };
  }

  // ── Upsert pasivo de Organization ─────────────────────────────────────────
  // Reemplaza a OrganizationsService.ensureExists() — llamado desde TenantGuard
  async ensureOrganization(
    ecosystemId: string,
    orgId: string,
    name: string,
    slug?: string,
  ) {
    // AISLAMIENTO ENTRE ECOSISTEMAS: el id de la organización viene de un claim del token. Sin esta
    // verificación, un ecosistema que emita un token con el organizationId de OTRO ecosistema
    // operaba como esa organización (el upsert por id solo actualizaba la existente).
    const existing = await this.organizations.findOwnerEcosystemId(orgId);
    if (existing && existing.ecosystemId !== ecosystemId) {
      this.logger.error(
        `[SEGURIDAD] El ecosistema ${ecosystemId} intentó usar la organización ${orgId}, que pertenece a ${existing.ecosystemId}`,
      );
      throw new ForbiddenException(
        'La organización pertenece a otro ecosistema',
      );
    }

    return this.organizations.upsertForEcosystem(
      ecosystemId,
      orgId,
      name,
      slug,
    );
  }
}
