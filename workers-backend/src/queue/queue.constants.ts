// workers-backend/src/jobs/jobs.constants.ts
//
// W-3.4: Concurrencia configurable via env vars sin redeploy.
// Ajustar en Railway → redeploy automático con los nuevos valores.

export const WORKER_QUEUES = {
  FAQ_INGEST:       'workers.faq-ingest',
  VECTOR_INDEX:     'workers.vector-index',
  CAMPAIGN_EMAIL:   'workers.campaign-email',
  ANALYTICS_EXPORT: 'workers.analytics-export',
  DLQ_FAQ_INGEST:      'workers.faq-ingest.dlq',
  DLQ_VECTOR_INDEX:    'workers.vector-index.dlq',
  DLQ_CAMPAIGN_EMAIL:  'workers.campaign-email.dlq',
} as const;

export type WorkerQueue = (typeof WORKER_QUEUES)[keyof typeof WORKER_QUEUES];

export const WORKER_JOBS = {
  FAQ_INGEST:     'faq.ingest',
  VECTOR_INDEX:   'vector.index',
  CAMPAIGN_EMAIL: 'campaign.email',
} as const;

// Concurrencia configurable via env — tuning sin redeploy
const concurrency = (envKey: string, defaultVal: number): number =>
  parseInt(process.env[envKey] ?? String(defaultVal), 10);

export const QUEUE_CONFIG = {
  [WORKER_QUEUES.FAQ_INGEST]: {
    attempts:    5,
    backoff:     { type: 'exponential' as const, delay: 3_000 },
    concurrency: concurrency('WORKERS_FAQ_INGEST_CONCURRENCY', 3),  // CPU-bound
  },
  [WORKER_QUEUES.VECTOR_INDEX]: {
    attempts:    5,
    backoff:     { type: 'exponential' as const, delay: 2_000 },
    concurrency: concurrency('WORKERS_VECTOR_INDEX_CONCURRENCY', 5), // IO-bound
  },
  [WORKER_QUEUES.CAMPAIGN_EMAIL]: {
    attempts:    3,
    backoff:     { type: 'exponential' as const, delay: 1_000 },
    concurrency: concurrency('WORKERS_CAMPAIGN_EMAIL_CONCURRENCY', 10), // IO-bound puro
  },
} as const;
