// chatia-backend/src/core/assistant/repository/assistant.repository.interface.ts
import type {
  AssistantConfig,
  AssistantSession,
} from '@/generated/prisma/client.js';
import type { UpdateAssistantConfigInput } from '@/core/assistant/schemas.js';

export const ASSISTANT_CONFIG_REPOSITORY = Symbol(
  'ASSISTANT_CONFIG_REPOSITORY',
);
export const ASSISTANT_SESSION_REPOSITORY = Symbol(
  'ASSISTANT_SESSION_REPOSITORY',
);

export interface IAssistantConfigRepository {
  findByProjectId(projectId: string): Promise<AssistantConfig | null>;
  /** Solo si la config es de la organización. */
  findOwned(
    projectId: string,
    organizationId: string,
  ): Promise<AssistantConfig | null>;
  create(data: {
    projectId: string;
    organizationId: string;
    systemPrompt: string;
  }): Promise<AssistantConfig>;
  update(
    projectId: string,
    data: UpdateAssistantConfigInput,
  ): Promise<AssistantConfig>;
  setEnabled(projectId: string, enabled: boolean): Promise<AssistantConfig>;
  /** Modelo preferido de la primera config habilitada de la organización (strategies). */
  findEnabledModelForOrganization(
    organizationId: string,
  ): Promise<{ groqModel: string } | null>;
}

export interface CreateSessionData {
  assistantConfigId: string;
  organizationId: string;
  externalUserId: string;
  channel: string;
}

export interface IAssistantSessionRepository {
  findForChannel(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
    channel: string,
  ): Promise<AssistantSession | null>;
  /** La sesión más reciente del usuario, en cualquier canal. */
  findLatestByUser(
    assistantConfigId: string,
    organizationId: string,
    externalUserId: string,
  ): Promise<AssistantSession | null>;
  findById(sessionId: string): Promise<AssistantSession | null>;
  create(data: CreateSessionData): Promise<AssistantSession>;
  /**
   * Agrega un mensaje al historial de forma ATÓMICA (una sola sentencia): dos mensajes seguidos
   * no se pisan. Devuelve false si la sesión no existe.
   */
  appendMessage(sessionId: string, message: unknown): Promise<boolean>;
  reset(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
}
