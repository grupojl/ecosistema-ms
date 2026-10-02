// chatia-backend/src/agents/domain/agent.entity.ts
// ADR-011 Sprint 2

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'BUSY';

export interface Agent {
  readonly id:                  string;
  readonly ecosystemId:         string;
  readonly organizationId:      string;
  readonly userId:              string;
  readonly displayName:         string;
  readonly status:              AgentStatus;
  readonly maxConcurrentChats:  number;
  readonly activeChats:         number;
  readonly createdAt:           Date;
}

/** Invariante: un agente OFFLINE no puede recibir nuevas conversaciones */
export function assertAgentAvailable(agent: Agent): void {
  if (agent.status === 'OFFLINE') {
    throw new AgentOfflineError(agent.id);
  }
  if (agent.activeChats >= agent.maxConcurrentChats) {
    throw new AgentAtCapacityError(agent.id, agent.maxConcurrentChats);
  }
}
