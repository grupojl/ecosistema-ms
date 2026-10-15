// src/infrastructure/queue/outgoing-job.ts
// Único lugar donde se arma el job de salida: lo usan el envío manual del agente y la respuesta automática.
// Antes el envío manual omitía `externalId` y `webhookVerifyToken` (URL ".../undefined/messages").
import type { JobsOptions } from 'bullmq';
import type { OutboundContext } from '@/core/conversations/repository/conversations.repository.interface.js';
import type { OutgoingMessageJobData } from '@/infrastructure/queue/processors/outgoing-message.processor.js';

export function buildOutgoingJob(
  ctx: OutboundContext,
  params: { messageId: string; conversationId: string; organizationId: string },
  text: string,
): OutgoingMessageJobData {
  return {
    messageId: params.messageId,
    conversationId: params.conversationId,
    organizationId: params.organizationId,
    channelType: ctx.channelType as OutgoingMessageJobData['channelType'],
    recipientExternalId: ctx.recipientExternalId,
    text,
    accessToken: ctx.accessToken,
    externalId: ctx.externalId,
    extraConfig: (ctx.extraConfig ?? {}) as Record<string, unknown>,
    webhookVerifyToken: ctx.webhookVerifyToken,
  };
}

export const outgoingJobOptions = (messageId: string): JobsOptions => ({
  jobId: `send_${messageId}`,
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 200,
});
