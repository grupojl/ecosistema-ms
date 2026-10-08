// chatia-backend/src/groq/groq-cb.service.ts
// Wrapper de GroqService con CircuitBreaker. ADR-005.
// Si Groq cae: CircuitOpenError → fallback a AssistantConfig.fallbackMessage.
// El AssistantChatService debe capturar CircuitOpenError y devolver el fallback.
import { Injectable, Logger }         from '@nestjs/common';
import { GroqService, type GroqMessage, type GroqResponse } from '@/infrastructure/groq/groq.service.js';
import { CircuitBreakerService, CircuitOpenError } from '@/infrastructure/common/services/circuit-breaker.service.js';

const CB_KEY     = 'groq-llm';
// LLM es el componente mas fragil — timeout alto, threshold bajo, recuperacion lenta
const CB_OPTIONS = { timeout: 15_000, errorThreshold: 30, resetTimeout: 120_000 };

export { CircuitOpenError };

@Injectable()
export class GroqCbService {
  private readonly logger = new Logger(GroqCbService.name);

  constructor(
    private readonly groq: GroqService,
    private readonly cb:   CircuitBreakerService,
  ) {}

  /**
   * Llama a Groq protegido por CB.
   * Lanza CircuitOpenError si el breaker esta abierto.
   * El caller (AssistantChatService) captura el error y devuelve fallbackMessage.
   */
  async chat(
    messages: GroqMessage[],
    options?: Parameters<GroqService['chat']>[1],
  ): Promise<GroqResponse> {
    return this.cb.execute(
      CB_KEY,
      () => this.groq.chat(messages, options),
      CB_OPTIONS,
    );
  }

  healthOf(): 'closed' | 'open' | 'halfOpen' | 'unknown' {
    return this.cb.healthOf(CB_KEY);
  }
}
