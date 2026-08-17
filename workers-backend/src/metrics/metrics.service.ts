// workers-backend/src/metrics/metrics.service.ts
//
// W-3.3: Prometheus metrics via OpenTelemetry.
// worker_job_duration_seconds{queue, status}
// worker_job_attempts_total{queue}
// worker_dlq_size{queue}
// worker_circuit_breaker_state{service}  (0=CLOSED, 1=HALF_OPEN, 2=OPEN)

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { metrics }     from '@opentelemetry/api';
import type { Counter, Histogram, UpDownCounter, ObservableGauge } from '@opentelemetry/api';
import { CircuitBreakerService }            from '../jobs/services/circuit-breaker.service.js';

@Injectable()
export class WorkersMetricsService implements OnModuleInit {
  private readonly logger = new Logger(WorkersMetricsService.name);

  private jobDuration!:     Histogram;
  private jobAttempts!:     Counter;
  private dlqSize!:         UpDownCounter;
  private cbState!:         ObservableGauge;

  constructor(private readonly breaker: CircuitBreakerService) {}

  onModuleInit(): void {
    const meter = metrics.getMeter('workers-backend', '1.0.0');

    this.jobDuration = meter.createHistogram('worker_job_duration_seconds', {
      description: 'Duración de jobs en segundos',
      unit:        's',
    });

    this.jobAttempts = meter.createCounter('worker_job_attempts_total', {
      description: 'Total de intentos de jobs por queue',
    });

    this.dlqSize = meter.createUpDownCounter('worker_dlq_size', {
      description: 'Cantidad de jobs en DLQ por queue',
    });

    // Observable gauge para estado del circuit breaker
    this.cbState = meter.createObservableGauge('worker_circuit_breaker_state', {
      description: 'Estado del circuit breaker: 0=CLOSED, 1=HALF_OPEN, 2=OPEN',
    });

    this.cbState.addCallback(async (obs) => {
      const states = await this.breaker.getAllStates();
      for (const [service, state] of Object.entries(states)) {
        const value = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
        obs.observe(value, { service });
      }
    });

    this.logger.log('Métricas OTel inicializadas');
  }

  recordJobCompleted(queue: string, status: 'DONE' | 'FAILED', durationMs: number): void {
    this.jobDuration.record(durationMs / 1_000, { queue, status });
  }

  recordJobAttempt(queue: string): void {
    this.jobAttempts.add(1, { queue });
  }

  recordDlqChange(queue: string, delta: number): void {
    this.dlqSize.add(delta, { queue });
  }
}
