// src/core/conversations/auto-reply.service.ts
//
// Respuesta automática del asistente a mensajes entrantes de WhatsApp / Instagram / Messenger / TikTok.
//
// ANTES: handleIncomingMessage solo registraba el mensaje; ningún código invocaba al asistente para los
// canales (LangGraphEngine no se llamaba y nadie encolaba en `assistant-chat`). El bot respondía solo por
// el widget / API. Esto cierra el circuito: mensaje entrante → asistente → mensaje saliente por el canal.
//
// Reglas:
//  - solo responde si la conversación está OPEN, con la IA activa y sin agente asignado
//  - el cliente puede apagar la IA por canal (AiConfig.isEnabled=false)
//  - si el ciudadano pide hablar con una persona (palabras de AiConfig.humanTakeoverKeywords), se pasa a
//    HUMAN_TAKEOVER: es por pedido EXPLÍCITO del usuario. Una caída de proveedores NUNCA escala a un humano.
//  - idempotente por mensaje entrante (los jobs se reintentan): una respuesta por mensaje
//  - tope de respuestas por conversación y minuto (anti-bucle bot↔bot y anti-abuso: cada una cuesta LLM)
import { addWithTimeout } from '@/infrastructure/queue/add-with-timeout.js';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  CONVERSATIONS_REPOSITORY,
  type AutoReplyContext,
  type IConversationsRepository,
} from '@/core/conversations/repository/conversations.repository.interface.js';
import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';
import { EventsGateway } from '@/infrastructure/events/events.gateway.js';
import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';
import { QUEUES, JOBS } from '@/infrastructure/queue/queue.constants.js';
import {
  buildOutgoingJob,
  outgoingJobOptions,
} from '@/infrastructure/queue/outgoing-job.js';

export interface AutoReplyJobData {
  conversationId: string;
  /** Mensaje entrante al que se responde. */
  inboundMessageId: string;
}

export type AutoReplySkipReason =
  | 'not_found'
  | 'not_open'
  | 'human_active'
  | 'ai_disabled'
  | 'already_replied'
  | 'empty_message'
  | 'rate_limited'
  | 'not_configured';

export type AutoReplyOutcome =
  | { status: 'replied'; messageId: string }
  | { status: 'handoff'; messageId: string }
  | { status: 'skipped'; reason: AutoReplySkipReason };

const HANDOFF_ACK =
  'Entendido, voy a pasar tu consulta a una persona del equipo. En breve te van a responder por acá.';

const envInt = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

@Injectable()
export class AutoReplyService {
  private readonly logger = new Logger(AutoReplyService.name);

  constructor(
    @Inject(CONVERSATIONS_REPOSITORY)
    private readonly repo: IConversationsRepository,
    private readonly chat: AssistantChatService,
    private readonly rateLimit: RateLimitService,
    private readonly events: EventsGateway,
    @InjectQueue(QUEUES.OUTGOING_MESSAGE) private readonly outQueue: Queue,
  ) {}

  /** Interruptor global: AUTOREPLY_ENABLED=false apaga las respuestas automáticas en todos los canales. */
  static get enabled(): boolean {
    return process.env['AUTOREPLY_ENABLED'] !== 'false';
  }

  async reply(job: AutoReplyJobData): Promise<AutoReplyOutcome> {
    const ctx = await this.repo.getAutoReplyContext(
      job.conversationId,
      job.inboundMessageId,
    );
    if (!ctx) return this.skip('not_found');

    const skip = this.shouldSkip(ctx);
    if (skip) return this.skip(skip);

    const limit = await this.rateLimit.hit(
      `autoreply:${ctx.conversationId}`,
      envInt('AUTOREPLY_MAX_PER_MIN', 8),
      60,
    );
    if (!limit.allowed) {
      this.logger.warn(
        `Respuesta automática limitada (conv ${ctx.conversationId}): ${limit.count}/${limit.limit} por minuto`,
      );
      return this.skip('rate_limited');
    }

    // El ciudadano pidió una persona: pasar a atención humana
    if (this.asksForHuman(ctx)) return this.handoff(ctx, job.inboundMessageId);

    let answer: string;
    try {
      const result = await this.chat.chat({
        projectSlug: ctx.projectSlug ?? undefined,
        organizationId: ctx.organizationId,
        ecosystemId: ctx.ecosystemId,
        // Sesión por ciudadano y canal: el asistente conserva su historial entre mensajes
        userId: `${ctx.channelType}:${ctx.recipientExternalId}`,
        message: ctx.inboundText,
        channel: ctx.channelType.toLowerCase(),
      });
      // sessionId vacío = asistente deshabilitado / feature apagada: no se le manda un aviso a cada mensaje
      if (!result.sessionId) return this.skip('not_configured');
      answer = result.response;
    } catch (err) {
      // La organización no tiene asistente configurado: no es un error para reintentar
      if (err instanceof NotFoundException) return this.skip('not_configured');
      throw err; // error real: BullMQ reintenta (la respuesta es idempotente)
    }

    const messageId = await this.send(ctx, answer, job.inboundMessageId);
    return { status: 'replied', messageId };
  }

  private shouldSkip(ctx: AutoReplyContext): AutoReplySkipReason | null {
    if (ctx.status !== 'OPEN') return 'not_open';
    if (!ctx.isAiActive || ctx.assignedAgentId) return 'human_active';
    if (!ctx.aiEnabled) return 'ai_disabled';
    if (ctx.alreadyReplied) return 'already_replied';
    if (!ctx.inboundText.trim()) return 'empty_message';
    return null;
  }

  private asksForHuman(ctx: AutoReplyContext): boolean {
    const text = ctx.inboundText.toLowerCase();
    return ctx.takeoverKeywords.some(
      (kw) => kw.trim() !== '' && text.includes(kw.trim().toLowerCase()),
    );
  }

  private async handoff(
    ctx: AutoReplyContext,
    inboundMessageId: string,
  ): Promise<AutoReplyOutcome> {
    await this.repo.updateStatus(
      ctx.conversationId,
      ctx.organizationId,
      'HUMAN_TAKEOVER',
    );
    await this.repo.updateAiActive(
      ctx.conversationId,
      ctx.organizationId,
      false,
    );
    this.events.emitEscalation(ctx.organizationId, ctx.conversationId);
    const messageId = await this.send(ctx, HANDOFF_ACK, inboundMessageId);
    this.logger.log(
      `Conversación ${ctx.conversationId} pasada a atención humana por pedido del ciudadano`,
    );
    return { status: 'handoff', messageId };
  }

  /** Guarda el mensaje saliente (marcado como de IA y ligado al entrante) y lo encola para el canal. */
  private async send(
    ctx: AutoReplyContext,
    text: string,
    inboundMessageId: string,
  ): Promise<string> {
    const msg = await this.repo.createOutboundMessage(
      ctx.conversationId,
      text,
      {
        isAiGenerated: true,
        replyTo: inboundMessageId,
      },
    );
    await addWithTimeout(
      () =>
        this.outQueue.add(
          JOBS.SEND_MESSAGE,
          buildOutgoingJob(ctx, { ...ctx, messageId: msg.id }, text),
          outgoingJobOptions(msg.id),
        ),
      QUEUES.OUTGOING_MESSAGE,
    );
    return msg.id;
  }

  private skip(reason: AutoReplySkipReason): AutoReplyOutcome {
    this.logger.debug(`Respuesta automática omitida: ${reason}`);
    return { status: 'skipped', reason };
  }
}
