// workers-backend/src/jobs/services/embedding.service.ts
//
// W-3.2: EmbeddingService con Circuit Breaker integrado.
// Si Groq falla 5 veces en 60s → circuito OPEN 30s → BullMQ reintenta cuando cierre.

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService }                    from '@nestjs/config';
import { CircuitBreakerService }            from './circuit-breaker.service.js';

const GROQ_EMBED_URL = 'https://api.groq.com/openai/v1/embeddings';
const DEFAULT_MODEL  = 'nomic-embed-text-v1_5';
const BATCH_SIZE     = 20;
const CB_KEY         = 'groq-embeddings';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private apiKey!: string;

  constructor(
    private readonly config:  ConfigService,
    private readonly breaker: CircuitBreakerService,
  ) {}

  onModuleInit(): void {
    const key = this.config.get<string>('GROQ_API_KEY');
    if (!key) throw new Error('GROQ_API_KEY no configurado en workers-backend');
    this.apiKey = key;
  }

  async embed(text: string, model = DEFAULT_MODEL): Promise<number[]> {
    const results = await this.embedMany([text], model);
    return results[0]!;
  }

  async embedMany(texts: string[], model = DEFAULT_MODEL): Promise<number[][]> {
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);

      const embeddings = await Promise.all(
        batch.map(t =>
          this.breaker.execute(
            CB_KEY,
            () => this.callGroq(t, model),
            { failureThreshold: 5, resetTimeoutMs: 30_000 },
          ),
        ),
      );

      results.push(...embeddings);
    }

    return results;
  }

  private async callGroq(text: string, model: string): Promise<number[]> {
    const response = await fetch(GROQ_EMBED_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body:   JSON.stringify({ model, input: text }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq ${response.status}: ${error}`);
    }

    const data      = await response.json() as { data: Array<{ embedding: number[] }> };
    const embedding = data.data[0]?.embedding;
    if (!embedding) throw new Error('Groq devolvió respuesta vacía');
    return embedding;
  }
}
