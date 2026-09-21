// marketing-backend/src/marketing.constants.ts
// Fuente de verdad única para nombres de queues.
// Ref: .claude/contracts/bullmq-queues.md — sección marketing-backend

export const MARKETING_QUEUES = {
  CAMPAIGN_SYNC:         'campaign-sync',
  CAMPAIGN_AUTOMATION:   'campaign-automation',
  MARKETING_ATTRIBUTION: 'marketing-attribution', // cross-service: producida por pasarelapagos
  DLQ:                   'marketing-dlq',
} as const;

export type MarketingQueue = typeof MARKETING_QUEUES[keyof typeof MARKETING_QUEUES];

// Thresholds del norte — Triple Whale: alerta si ROAS < 1.0
export const MARKETING_THRESHOLDS = {
  ROAS_CRITICAL: 1.0,
  ROAS_WARNING:  1.5,
  FREQUENCY_MAX: 3.5,
} as const;
