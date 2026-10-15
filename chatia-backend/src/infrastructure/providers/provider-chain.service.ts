// src/infrastructure/providers/provider-chain.service.ts
//
// Cadena de fallback genérica por capacidad (LLM, STT, TTS, imagen, embeddings).
// Cada proveedor corre detrás de su propio circuit breaker; si falla (o está
// abierto, o no está configurado) se pasa al siguiente.
// Si falla toda la cadena → AllProvidersFailedError. Quien llama decide cómo
// degradar (texto, caption, búsqueda por texto). NUNCA escalar a un humano por esto.
// Ref: .claude/infrastructure/providers-fallback.md
import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreakerService,
  type CircuitBreakerOptions,
} from '@/infrastructure/common/services/circuit-breaker.service.js';
import {
  providerCalls,
  providerChainExhausted,
  providerDuration,
} from '@/infrastructure/providers/provider-metrics.js';

export interface ChainStep<T> {
  provider: string;
  cbKey: string;
  /** false = sin API key u otra config faltante → se saltea. */
  enabled: boolean;
  cb?: CircuitBreakerOptions;
  run: () => Promise<T>;
}

export interface ChainFailure {
  provider: string;
  reason: string;
}

export interface ChainResult<T> {
  value: T;
  provider: string;
}

export class AllProvidersFailedError extends Error {
  constructor(
    readonly capability: string,
    readonly failures: ChainFailure[],
  ) {
    super(
      `Todos los proveedores de ${capability} fallaron: ` +
        failures.map((f) => `${f.provider} (${f.reason})`).join('; '),
    );
    this.name = 'AllProvidersFailedError';
  }
}

@Injectable()
export class ProviderChainService {
  private readonly logger = new Logger(ProviderChainService.name);

  constructor(private readonly breaker: CircuitBreakerService) {}

  async run<T>(
    capability: string,
    steps: ChainStep<T>[],
  ): Promise<ChainResult<T>> {
    const failures: ChainFailure[] = [];

    for (const step of steps) {
      if (!step.enabled) {
        failures.push({ provider: step.provider, reason: 'no configurado' });
        providerCalls.inc({
          capability,
          provider: step.provider,
          outcome: 'skipped',
        });
        continue;
      }

      const stopTimer = providerDuration.startTimer({
        capability,
        provider: step.provider,
      });
      try {
        const value = await this.breaker.execute(step.cbKey, step.run, step.cb);
        stopTimer();
        providerCalls.inc({
          capability,
          provider: step.provider,
          outcome: 'success',
        });
        if (failures.some((f) => f.reason !== 'no configurado')) {
          this.logger.warn(
            `[${capability}] respondió el fallback "${step.provider}"`,
          );
        }
        return { value, provider: step.provider };
      } catch (err) {
        stopTimer();
        providerCalls.inc({
          capability,
          provider: step.provider,
          outcome: 'failure',
        });
        const reason = err instanceof Error ? err.message : String(err);
        failures.push({ provider: step.provider, reason });
        this.logger.warn(`[${capability}] ${step.provider} falló: ${reason}`);
      }
    }

    // Alerta al equipo técnico (log nivel error → Prometheus/alertas), nunca a agentes de atención.
    providerChainExhausted.inc({ capability });
    this.logger.error(
      `[ALERTA TÉCNICA] cadena agotada para ${capability}: ${JSON.stringify(failures)}`,
    );
    throw new AllProvidersFailedError(capability, failures);
  }
}
