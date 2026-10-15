// src/core/assignment/assignment.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AGENTS_REPOSITORY,
  type IAgentsRepository,
} from '@/core/agents/repository/agents.repository.interface.js';
import {
  CONVERSATIONS_REPOSITORY,
  type IConversationsRepository,
} from '@/core/conversations/repository/conversations.repository.interface.js';

export type AssignmentStrategy = 'round-robin' | 'least-load';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  // Mapa en memoria: organizationId → índice del último agente asignado
  // Solo se usa con la estrategia round-robin
  private readonly roundRobinCursors = new Map<string, number>();

  constructor(
    @Inject(AGENTS_REPOSITORY) private readonly agents: IAgentsRepository,
    @Inject(CONVERSATIONS_REPOSITORY)
    private readonly conversations: IConversationsRepository,
  ) {}

  /**
   * Devuelve el agentId a asignar, o null si no hay agentes activos.
   * Se llama al crear una conversación nueva.
   */
  async assignAgent(
    organizationId: string,
    strategy: AssignmentStrategy = 'least-load',
  ): Promise<string | null> {
    // orden estable (más antiguo primero) para round-robin
    const agentIds = await this.agents.listActiveIdsByCreation(organizationId);

    if (!agentIds.length) {
      this.logger.debug(`No hay agentes activos en org ${organizationId}`);
      return null;
    }

    if (strategy === 'round-robin') {
      return this.roundRobin(organizationId, agentIds);
    }

    return this.leastLoad(organizationId, agentIds);
  }

  // ── Estrategias ───────────────────────────────────────────────────────────

  private roundRobin(organizationId: string, agentIds: string[]): string {
    const current = this.roundRobinCursors.get(organizationId) ?? 0;
    const next = (current + 1) % agentIds.length;
    this.roundRobinCursors.set(organizationId, next);

    const assigned = agentIds[next];
    this.logger.debug(
      `[round-robin] org:${organizationId} → agente ${assigned} (slot ${next}/${agentIds.length - 1})`,
    );
    return assigned;
  }

  private async leastLoad(
    organizationId: string,
    agentIds: string[],
  ): Promise<string> {
    // Contar conversaciones activas (OPEN + HUMAN_TAKEOVER) por agente
    const counts = await this.conversations.countActiveByAgents(agentIds);

    // Construir mapa agentId → carga
    const loadMap = new Map<string, number>(agentIds.map((id) => [id, 0]));
    for (const row of counts) loadMap.set(row.agentId, row.count);

    // Elegir el agente con menor carga (en empate, el primero en la lista)
    let minLoad = Infinity;
    let assigned = agentIds[0];

    for (const [agentId, load] of loadMap.entries()) {
      if (load < minLoad) {
        minLoad = load;
        assigned = agentId;
      }
    }

    this.logger.debug(
      `[least-load] org:${organizationId} → agente ${assigned} (carga: ${minLoad})`,
    );
    return assigned;
  }
}
