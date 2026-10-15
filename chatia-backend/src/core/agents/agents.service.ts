// chatia-backend/src/core/agents/agents.service.ts
// Todo acceso a DB va por IAgentsRepository (ADR-002) — este service no conoce Prisma.
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AGENTS_REPOSITORY,
  type IAgentsRepository,
} from '@/core/agents/repository/agents.repository.interface.js';
import {
  assertCanUpdateAgent,
  assertRegistrationMatchesToken,
} from '@/core/agents/domain/agent.entity.js';
import {
  AgentForbiddenError,
  AgentIdentityMismatchError,
} from '@/core/agents/domain/agent.errors.js';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';
import type {
  RegisterAgentInput,
  UpdateAgentInput,
} from '@/core/agents/schemas.js';

type Actor = Pick<TenantContext, 'firebaseUid' | 'organizationId' | 'role'>;

@Injectable()
export class AgentsService {
  constructor(
    @Inject(AGENTS_REPOSITORY) private readonly repo: IAgentsRepository,
  ) {}

  /** Alta/actualización de perfil del agente AUTENTICADO. La identidad sale del token, no del body. */
  async register(actor: Actor, dto: RegisterAgentInput) {
    try {
      assertRegistrationMatchesToken(actor, dto);
    } catch (err) {
      if (err instanceof AgentIdentityMismatchError)
        throw new ForbiddenException(err.message);
      throw err;
    }
    return this.repo.upsertByFirebaseUid({
      firebaseUid: actor.firebaseUid,
      organizationId: actor.organizationId,
      name: dto.name,
      email: dto.email,
      avatarUrl: dto.avatarUrl,
    });
  }

  me(actor: Actor) {
    return this.repo.findByFirebaseUid(actor.firebaseUid, actor.organizationId);
  }

  list(actor: Actor) {
    return this.repo.listActive(actor.organizationId);
  }

  async update(id: string, actor: Actor, dto: UpdateAgentInput) {
    const target = await this.repo.findInOrganization(id, actor.organizationId);
    if (!target) throw new NotFoundException(`Agente ${id} no encontrado`);

    try {
      assertCanUpdateAgent(
        actor,
        target,
        Object.keys(dto).filter(
          (k) => dto[k as keyof UpdateAgentInput] !== undefined,
        ),
      );
    } catch (err) {
      if (err instanceof AgentForbiddenError)
        throw new ForbiddenException(err.message);
      throw err;
    }
    return this.repo.update(id, actor.organizationId, dto);
  }
}
