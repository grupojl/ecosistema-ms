// src/infrastructure/common/services/embedding.service.ts
//
// Embeddings reales vía endpoint /embeddings (SiliconFlow `BAAI/bge-m3` por defecto,
// multilingüe, 1024 dims). Antes se le pedía a un LLM de chat que "inventara" los números.
//
// Sin fallback entre modelos: vectores de modelos distintos no son comparables.
// Si falla lanza AllProvidersFailedError (nunca devuelve ceros) y el caller degrada
// a búsqueda por texto. Cambiar EMBEDDINGS_MODEL obliga a reindexar la base de conocimiento,
// y workers-backend (que indexa) debe usar el MISMO modelo.
import { Injectable } from '@nestjs/common';
import { ProviderChainService } from '@/infrastructure/providers/provider-chain.service.js';
import { parseProviderOrder } from '@/infrastructure/providers/provider-order.js';
import {
  createEmbeddings,
  resolveEndpoint,
} from '@/infrastructure/providers/openai-compat.client.js';

const EMBEDDING_PROVIDERS = ['siliconflow', 'groq'] as const;
const MAX_INPUT_CHARS = 4000;
const CB_OPTIONS = {
  timeout: 10_000,
  errorThreshold: 40,
  resetTimeout: 60_000,
};
// Indexar documentos manda lotes grandes: más margen que una consulta suelta
const BATCH_CB_OPTIONS = {
  timeout: 30_000,
  errorThreshold: 40,
  resetTimeout: 60_000,
};
const BATCH_SIZE = 32;

@Injectable()
export class EmbeddingService {
  constructor(private readonly chain: ProviderChainService) {}

  /** Modelo activo (para registrar con qué modelo se generó cada vector). */
  get modelName(): string {
    const provider = this.provider();
    const fallback =
      provider === 'groq' ? 'nomic-embed-text-v1_5' : 'BAAI/bge-m3';
    return process.env['EMBEDDINGS_MODEL'] ?? fallback;
  }

  async embed(text: string): Promise<number[]> {
    const [vector] = await this.run([text], CB_OPTIONS);
    return vector;
  }

  /** Varios textos (indexación): en lotes, mismo orden de entrada. Falla entero si falla un lote. */
  async embedMany(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      out.push(
        ...(await this.run(texts.slice(i, i + BATCH_SIZE), BATCH_CB_OPTIONS)),
      );
    }
    return out;
  }

  private async run(
    texts: string[],
    cb: typeof CB_OPTIONS,
  ): Promise<number[][]> {
    const provider = this.provider();
    const endpoint = resolveEndpoint(provider);
    const model = this.modelName;
    const inputs = texts.map((t) => t.slice(0, MAX_INPUT_CHARS));

    const { value } = await this.chain.run('embeddings', [
      {
        provider,
        cbKey: `${provider}-embeddings`,
        enabled: Boolean(endpoint.apiKey),
        cb,
        run: () =>
          createEmbeddings(endpoint, { model, inputs, timeoutMs: cb.timeout }),
      },
    ]);

    return value.map((v) => this.normalize(v));
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  private provider(): (typeof EMBEDDING_PROVIDERS)[number] {
    return (
      parseProviderOrder(
        process.env['EMBEDDINGS_PROVIDER'],
        EMBEDDING_PROVIDERS,
        ['siliconflow'],
      )[0] ?? 'siliconflow'
    );
  }

  private normalize(v: number[]): number[] {
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    return norm === 0 ? v : v.map((x) => x / norm);
  }
}
