// pasarelapagos-backend/src/core/payments/domain/payment-metrics.port.ts
// Puerto de métricas — el core depende de esta abstracción, no de Prometheus.
// MetricsService en infrastructure/metrics/ implementa esta interface.

export const PAYMENT_METRICS_PORT = Symbol("PAYMENT_METRICS_PORT");

export interface IPaymentMetricsPort {
  recordPaymentCreated(params: { tenantId: string; method: string; currency: string }): void;
  recordPaymentCaptured(params: { tenantId: string; providerId: string; durationMs?: number }): void;
  recordPaymentFailed(params: { tenantId: string; providerId: string; reason: string }): void;
  recordWebhook(params: { provider: string; status: string; lagMs?: number }): void;
}
