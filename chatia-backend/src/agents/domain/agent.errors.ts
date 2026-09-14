// chatia-backend/src/agents/domain/agent.errors.ts
export class AgentOfflineError extends Error {
  constructor(agentId: string) {
    super(`Agent ${agentId} is OFFLINE and cannot receive conversations`);
    this.name = 'AgentOfflineError';
  }
}

export class AgentAtCapacityError extends Error {
  constructor(agentId: string, maxChats: number) {
    super(`Agent ${agentId} is at capacity (${maxChats} concurrent chats)`);
    this.name = 'AgentAtCapacityError';
  }
}
