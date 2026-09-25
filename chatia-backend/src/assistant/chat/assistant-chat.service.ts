// chatia-backend/src/assistant/chat/assistant-chat.service.ts
// ADR-019 v2: ProjectStrategyRegistry conectado — enriquece contexto por org antes del LLM.
import { Injectable, Logger, Optional } from '@nestjs/common';
import { GroqService, GroqMessage }      from '@/groq/groq.service';
import { EventsGateway }                 from '@/events/events.gateway';
import { PrismaService }                 from '@/prisma/prisma.service';
import { AssistantConfigService }        from '@/config/assistant-config.service';
import { AssistantSessionService }       from '@/session/assistant-session.service';
import { ProjectStrategyRegistry }       from '@/core/strategies/project-strategy.registry.js';

export type RagServiceLike = {
  answer(kbId: string, question: string, options?: object): Promise<{ answer: string; sources: unknown[] }>;
};

export interface ChatInput {
  projectSlug:    string;
  organizationId: string;
  ecosystemId:    string;   // NUEVO — requerido para resolver la strategy
  userId:         string;
  message:        string;
  channel?:       string;
}

export interface ChatOutput {
  sessionId:       string;
  response:        string;
  tokensUsed:      number;
  modelUsed:       string;
  usedFaqFallback: boolean;
  faqSources?:     unknown[];
}

export const RAG_SERVICE_TOKEN = 'RAG_SERVICE';

@Injectable()
export class AssistantChatService {
  private readonly logger = new Logger(AssistantChatService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly groq:            GroqService,
    private readonly events:          EventsGateway,
    private readonly configService:   AssistantConfigService,
    private readonly sessionService:  AssistantSessionService,
    private readonly strategyRegistry: ProjectStrategyRegistry,
    @Optional() private readonly ragService?: RagServiceLike,
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    const { projectSlug, organizationId, ecosystemId, userId, message, channel = 'api' } = input;

    // ── 1. Resolver strategy por ecosistema + perfil de org ──────────────────
    const strategy = this.strategyRegistry.get(ecosystemId);
    const projectCtx = await strategy.enrichConversationContext({
      conversationId:  '',   // aún no existe — se asigna después de getOrCreate
      organizationId,
      ecosystemId,
      channel:         channel,
      userMessage:     message,
    });

    // ── 2. Verificar feature flags de la org ──────────────────────────────────
    if (!projectCtx.orgProfile.featureFlags.aiAssistantEnabled) {
      return {
        sessionId: '', response: 'El asistente no está disponible para tu organización.',
        tokensUsed: 0, modelUsed: '', usedFaqFallback: false,
      };
    }

    // ── 3. Config del proyecto (puede sobreescribir el modelo de la strategy) ─
    const config = await this.configService.findByProjectSlug(projectSlug, organizationId);

    if (!config.isEnabled) {
      return {
        sessionId: '', response: config.fallbackMessage ?? 'El asistente no está disponible.',
        tokensUsed: 0, modelUsed: '', usedFaqFallback: false,
      };
    }

    const session = await this.sessionService.getOrCreate(config.id, organizationId, userId, channel);
    await this.sessionService.appendMessage(session.id, 'user', message);
    this.events.emitToAgent(organizationId, 'assistant:typing', { sessionId: session.id, userId });

    const history = await this.sessionService.getHistory(session.id, config.contextWindow);

    // systemPrompt viene de la strategy (personalizado por org) y se combina con el config del proyecto
    const systemPrompt = projectCtx.systemPrompt || this.buildSystemPrompt(config);
    const modelToUse   = config.groqModel || projectCtx.preferredModel;

    const messages: GroqMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(0, -1).map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ];

    let responseText: string;
    let tokensUsed = 0;
    let modelUsed  = modelToUse;
    let usedFaqFallback = false;
    let faqSources: unknown[] | undefined;

    try {
      const result = await this.groq.chat(messages, {
        model:       modelToUse as never // @ecosistema-ms/jsonb-cast,
        temperature: config.temperature,
        maxTokens:   config.maxTokens,
      });
      responseText = result.content;
      tokensUsed   = result.tokensUsed;
      modelUsed    = result.model;

      // FAQ fallback: usa el flag de la org + el config del proyecto
      const faqEnabled = projectCtx.orgProfile.featureFlags.faqEnabled && projectCtx.useFaqFallback;
      if (faqEnabled && config.faqKbId && this.isLowConfidence(responseText) && this.ragService) {
        try {
          const ragResult = await this.ragService.answer(config.faqKbId, message, {
            groqModel: modelToUse, temperature: config.temperature, maxTokens: config.maxTokens,
          });
          responseText = ragResult.answer;
          faqSources   = ragResult.sources;
          usedFaqFallback = true;
        } catch (ragErr) {
          this.logger.warn(`RAG fallback falló: ${ragErr}`);
        }
      }
    } catch (err) {
      this.logger.error(`Error en Groq: ${err}`);
      responseText = config.fallbackMessage ?? '¡Disculpá! Tuve un problema. ¿Podés repetir?';
    }

    await this.sessionService.appendMessage(session.id, 'assistant', responseText);
    this.events.emitToAgent(organizationId, 'assistant:message', {
      sessionId: session.id, userId, message: responseText, usedFaqFallback,
    });

    // ── 4. Side-effects post-respuesta (analytics, stage, escalación) ────────
    await strategy.afterConversationResult(
      {
        conversationId:   session.id,
        organizationId,
        ecosystemId,
        assistantMessage: responseText,
        newStage:         'INITIAL',
        escalated:        false,
        metadata:         { usedFaqFallback, tokensUsed, modelUsed },
      },
      projectCtx,
    );

    return { sessionId: session.id, response: responseText, tokensUsed, modelUsed, usedFaqFallback, faqSources };
  }

  private buildSystemPrompt(config: { systemPrompt: string; personaName: string }): string {
    return `${config.systemPrompt || 'Sos un asistente virtual amigable.'}\n\nTu nombre es ${config.personaName}.`;
  }

  private isLowConfidence(response: string): boolean {
    return ['no sé', 'no tengo información', 'no puedo responder', 'no estoy seguro', 'no lo sé']
      .some(kw => response.toLowerCase().includes(kw));
  }
}
