// chatia-backend/src/core/agents/domain/agent.errors.ts — errores de dominio, sin NestJS.
export class AgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Agente ${agentId} no encontrado`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentForbiddenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'AgentForbiddenError';
  }
}

export class AgentIdentityMismatchError extends Error {
  constructor(field: 'firebaseUid' | 'organizationId') {
    super(`${field} del body no coincide con el del token`);
    this.name = 'AgentIdentityMismatchError';
  }
}
