// src/infrastructure/queue/queue.constants.ts

export const QUEUES = {
  INCOMING_MESSAGE: 'incoming-message',
  OUTGOING_MESSAGE: 'outgoing-message',
  ASSISTANT_CHAT: 'assistant-chat', // Sprint 2
  FAQ_INGEST: 'faq-ingest', // Sprint 3
  AUTO_REPLY: 'auto-reply', // respuesta automática del asistente a canales
} as const;

export const JOBS = {
  PROCESS_MESSAGE: 'process-message',
  SEND_MESSAGE: 'send-message',
  ASSISTANT_PROCESS: 'assistant-process', // Sprint 2
  FAQ_INGEST_DOCUMENT: 'faq-ingest-document', // Sprint 3
  AUTO_REPLY: 'auto-reply',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
export type JobName = (typeof JOBS)[keyof typeof JOBS];
