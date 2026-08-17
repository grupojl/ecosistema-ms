// notificaciones-backend/src/metrics/metrics.service.ts
//
// N-3.4: Prometheus metrics via OpenTelemetry.
// notification_sent_total{channel, status, org}
// notification_processing_duration_ms{channel}
// notification_dlq_size

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { metrics }     from '@opentelemetry/api';
import type { Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);

  private sentTotal!:       Counter;
  private durationMs!:      Histogram;
  private dlqSize!:         UpDownCounter;

  onModuleInit(): void {
    const meter = metrics.getMeter('notificaciones-backend', '1.0.0');

    this.sentTotal = meter.createCounter('notification_sent_total', {
      description: 'Total de notificaciones procesadas por canal y estado',
    });

    this.durationMs = meter.createHistogram('notification_processing_duration_ms', {
      description: 'Duración del procesamiento de notificaciones en ms',
      unit:        'ms',
    });

    this.dlqSize = meter.createUpDownCounter('notification_dlq_size', {
      description: 'Cantidad actual de jobs en la DLQ',
    });

    this.logger.log('Métricas OTel inicializadas');
  }

  recordSent(attrs: { channel: string; status: string; organizationId: string }): void {
    this.sentTotal.add(1, {
      channel: attrs.channel,
      status:  attrs.status,
      org:     attrs.organizationId,
    });
  }

  recordDuration(channel: string, durationMs: number): void {
    this.durationMs.record(durationMs, { channel });
  }

  setDlqSize(delta: number): void {
    this.dlqSize.add(delta);
  }
}
