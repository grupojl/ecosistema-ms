// src/infrastructure/providers/provider-metrics.ts
//
// Métricas Prometheus de las cadenas de proveedores (se exponen en /metrics junto con las por defecto).
//   provider_calls_total{capability,provider,outcome}  outcome = success | failure | skipped
//   provider_call_duration_seconds{capability,provider}
//   provider_chain_exhausted_total{capability}         ← alerta: nadie pudo responder
import { Counter, Histogram, register } from 'prom-client';

function counter(
  name: string,
  help: string,
  labelNames: string[],
): Counter<string> {
  return (
    (register.getSingleMetric(name) as Counter<string> | undefined) ??
    new Counter({ name, help, labelNames })
  );
}

function histogram(
  name: string,
  help: string,
  labelNames: string[],
): Histogram<string> {
  return (
    (register.getSingleMetric(name) as Histogram<string> | undefined) ??
    new Histogram({
      name,
      help,
      labelNames,
      buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 30],
    })
  );
}

export const providerCalls = counter(
  'provider_calls_total',
  'Llamadas a proveedores externos por capacidad, proveedor y resultado',
  ['capability', 'provider', 'outcome'],
);

export const providerDuration = histogram(
  'provider_call_duration_seconds',
  'Latencia de las llamadas a proveedores externos',
  ['capability', 'provider'],
);

export const providerChainExhausted = counter(
  'provider_chain_exhausted_total',
  'Veces que fallaron TODOS los proveedores de una capacidad',
  ['capability'],
);
