import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { makeHistogramProvider, makeCounterProvider } from '@willsoto/nestjs-prometheus';

export function createMetricsModule() {
  return PrometheusModule.register({
    path:       '/metrics',
    defaultMetrics: { enabled: true },
  });
}

export const HTTP_REQUEST_DURATION = makeHistogramProvider({
  name:    'http_request_duration_seconds',
  help:    'Duración de requests HTTP en segundos',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const HTTP_REQUESTS_TOTAL = makeCounterProvider({
  name:    'http_requests_total',
  help:    'Total de requests HTTP',
  labelNames: ['method', 'route', 'status_code', 'service'],
});

export const BULLMQ_JOB_DURATION = makeHistogramProvider({
  name:    'bullmq_job_duration_seconds',
  help:    'Duración de jobs BullMQ en segundos',
  labelNames: ['queue', 'job_name', 'service'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
});

export const BULLMQ_JOB_FAILURES_TOTAL = makeCounterProvider({
  name:    'bullmq_job_failures_total',
  help:    'Total de jobs BullMQ fallidos',
  labelNames: ['queue', 'job_name', 'service'],
});

export const CIRCUIT_BREAKER_STATE = makeCounterProvider({
  name:    'circuit_breaker_state_changes_total',
  help:    'Cambios de estado del circuit breaker',
  labelNames: ['key', 'from_state', 'to_state', 'service'],
});

export { PrometheusModule } from '@willsoto/nestjs-prometheus';
export { makeHistogramProvider, makeCounterProvider } from '@willsoto/nestjs-prometheus';
