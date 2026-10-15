// chatia-backend/src/core/assistant/chat/assistant-chat.service.ts
// ADR-019 v2: ProjectStrategyRegistry conectado — enriquece contexto por org antes del LLM.
// LLM con cadena de fallback (Groq → SiliconFlow). Si toda la cadena cae se pide al usuario
// que reintente y se alerta al equipo técnico; NUNCA se escala a un humano por esto.
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  LlmService,
  type LlmMessage,
} from '@/infrastructure/providers/llm.service.js';
import { AllProvidersFailedError } from '@/infrastructure/providers/provider-chain.service.js';
import { EventsGateway } from '@/infrastructure/events/events.gateway.js';
import {
  ECOSYSTEMS_REPOSITORY,
  type IEcosystemsRepository,
} from '@/core/ecosystem/repository/ecosystems.repository.interface.js';
import { AssistantConfigService } from '@/core/assistant/config/assistant-config.service.js';
import { AssistantSessionService } from '@/core/assistant/session/assistant-session.service.js';
import { ProjectStrategyRegistry } from '@/core/strategies/project-strategy.registry.js';

export type RagServiceLike = {
  answer(
    kbId: string,
    question: string,
    options?: object,
  ): Promise<{ answer: string; sources: unknown[] }>;
};

export interface ChatInput {
  projectSlug?: string; // opcional: sin slug se usa el proyecto por defecto de la org
  organizationId: string;
  ecosystemId: string; // NUEVO — requerido para resolver la strategy
  userId: string;
  message: string;
  channel?: string;
}

export interface ChatOutput {
  sessionId: string;
  response: string;
  tokensUsed: number;
  modelUsed: string;
  usedFaqFallback: boolean;
  faqSources?: unknown[];
}

export const RAG_SERVICE_TOKEN = 'RAG_SERVICE';

// Falla de proveedores: se pide reintentar. No es un handoff ni se disfraza de uno.
const PROVIDER_DOWN_MESSAGE =
  'Estamos con un inconveniente técnico y no pude procesar tu mensaje. Probá de nuevo en unos minutos.';

@Injectable()
export class AssistantChatService {
  private readonly logger = new Logger(AssistantChatService.name);

  constructor(
    @Inject(ECOSYSTEMS_REPOSITORY)
    private readonly ecosystems: IEcosystemsRepository,
    private readonly llm: LlmService,
    private readonly events: EventsGateway,
    private readonly configService: AssistantConfigService,
    private readonly sessionService: AssistantSessionService,
    private readonly strategyRegistry: ProjectStrategyRegistry,
    @Optional() private readonly ragService?: RagServiceLike,
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    const {
      projectSlug,
      organizationId,
      ecosystemId,
      userId,
      message,
      channel = 'api',
    } = input;

    // ── 1. Resolver strategy por ecosistema + perfil de org ──────────────────
    const strategy = this.strategyRegistry.get(
      ecosystemId,
      await this.resolveProjectType(ecosystemId),
    );
    const projectCtx = await strategy.enrichConversationContext({
      conversationId: '', // aún no existe — se asigna después de getOrCreate
      organizationId,
      ecosystemId,
      channel: channel,
      userMessage: message,
    });

    // ── 2. Verificar feature flags de la org ──────────────────────────────────
    if (!projectCtx.orgProfile.featureFlags.aiAssistantEnabled) {
      return {
        sessionId: '',
        response: 'El asistente no está disponible para tu organización.',
        tokensUsed: 0,
        modelUsed: '',
        usedFaqFallback: false,
      };
    }

    // ── 3. Config del proyecto (puede sobreescribir el modelo de la strategy) ─
    const config = projectSlug
      ? await this.configService.findByProjectSlug(projectSlug, organizationId)
      : await this.configService.findDefaultForOrg(organizationId);

    if (!config.isEnabled) {
      return {
        sessionId: '',
        response: config.fallbackMessage ?? 'El asistente no está disponible.',
        tokensUsed: 0,
        modelUsed: '',
        usedFaqFallback: false,
      };
    }

    const session = await this.sessionService.getOrCreate(
      config.id,
      organizationId,
      userId,
      channel,
    );
    await this.sessionService.appendMessage(session.id, 'user', message);
    this.events.emitToAgent(organizationId, 'assistant:typing', {
      sessionId: session.id,
      userId,
    });

    const history = await this.sessionService.getHistory(
      session.id,
      config.contextWindow,
    );

    // systemPrompt viene de la strategy (personalizado por org) y se combina con el config del proyecto
    const systemPrompt =
      projectCtx.systemPrompt || this.buildSystemPrompt(config);
    // GROQ_MODEL (env) manda sobre la config del proyecto y la strategy
    const modelToUse =
      process.env.GROQ_MODEL || config.groqModel || projectCtx.preferredModel;

    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(0, -1).map((h) => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    let responseText: string;
    let tokensUsed = 0;
    let modelUsed = modelToUse;
    let usedFaqFallback = false;
    let faqSources: unknown[] | undefined;
    let providerFailed = false;

    try {
      const result = await this.llm.chat(messages, {
        model: modelToUse,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
      responseText = result.content;
      tokensUsed = result.tokensUsed;
      modelUsed = result.model;

      // FAQ fallback: usa el flag de la org + el config del proyecto
      const faqEnabled =
        projectCtx.orgProfile.featureFlags.faqEnabled &&
        projectCtx.useFaqFallback;
      if (
        faqEnabled &&
        config.faqKbId &&
        this.isLowConfidence(responseText) &&
        this.ragService
      ) {
        try {
          const ragResult = await this.ragService.answer(
            config.faqKbId,
            message,
            {
              groqModel: modelToUse,
              temperature: config.temperature,
              maxTokens: config.maxTokens,
              organizationId,
            },
          );
          responseText = ragResult.answer;
          faqSources = ragResult.sources;
          usedFaqFallback = true;
        } catch (ragErr) {
          this.logger.warn(`RAG fallback falló: ${String(ragErr)}`);
        }
      }
    } catch (err) {
      if (err instanceof AllProvidersFailedError) {
        // La cadena ya registró la alerta técnica. Sin 'assistant:escalate': los agentes no atienden caídas.
        providerFailed = true;
        modelUsed = 'fallback';
        responseText = PROVIDER_DOWN_MESSAGE;
      } else {
        this.logger.error(`Error en LLM: ${String(err)}`);
        responseText =
          config.fallbackMessage ??
          '¡Disculpá! Tuve un problema. ¿Podés repetir?';
      }
    }

    await this.sessionService.appendMessage(
      session.id,
      'assistant',
      responseText,
    );
    this.events.emitToAgent(organizationId, 'assistant:message', {
      sessionId: session.id,
      userId,
      message: responseText,
      usedFaqFallback,
    });

    // ── 4. Side-effects post-respuesta (analytics, stage, escalación) ────────
    await strategy.afterConversationResult(
      {
        conversationId: session.id,
        organizationId,
        ecosystemId,
        assistantMessage: responseText,
        newStage: 'INITIAL',
        escalated: false,
        metadata: { usedFaqFallback, tokensUsed, modelUsed, providerFailed },
      },
      projectCtx,
    );

    return {
      sessionId: session.id,
      response: responseText,
      tokensUsed,
      modelUsed,
      usedFaqFallback,
      faqSources,
    };
  }

  /** Tipo de strategy del ecosistema: Ecosystem.config.projectType ('welver' | 'manzana' | 'mexus'). */
  private async resolveProjectType(
    ecosystemId: string,
  ): Promise<string | null> {
    const eco = await this.ecosystems.findById(ecosystemId);
    const type = (eco?.config as { projectType?: unknown } | null)?.projectType;
    return typeof type === 'string' ? type : null;
  }

  private buildSystemPrompt(config: {
    systemPrompt: string;
    personaName: string;
  }): string {
    return `${config.systemPrompt || 'Sos un asistente virtual amigable.'}\n\nTu nombre es ${config.personaName}.`;
  }

  private isLowConfidence(response: string): boolean {
    return [
      'no sé',
      'no tengo información',
      'no puedo responder',
      'no estoy seguro',
      'no lo sé',
    ].some((kw) => response.toLowerCase().includes(kw));
  }
}
