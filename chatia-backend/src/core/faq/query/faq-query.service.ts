// src/core/faq/query/faq-query.service.ts
//
// Búsqueda en la base de conocimiento. Orden de preferencia:
//   1. pgvector (índice HNSW, rápido)          — si la columna existe y el vector tiene la dimensión correcta
//   2. similitud en memoria sobre el Json      — respaldo cuando no hay pgvector
//   3. búsqueda por texto                      — si los embeddings no están disponibles o el índice es de otro modelo
// Nunca se devuelven resultados puntuados con vectores de ceros ni de otro modelo.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  KNOWLEDGE_REPOSITORY,
  type IKnowledgeRepository,
} from '@/core/faq/repository/knowledge.repository.interface.js';
import { EmbeddingService } from '@/infrastructure/common/services/embedding.service.js';
import { KbVectorStore } from '@/core/faq/vector/kb-vector.store.js';

export interface ChunkResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
}

@Injectable()
export class FaqQueryService {
  private readonly logger = new Logger(FaqQueryService.name);

  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: IKnowledgeRepository,
    private readonly embedding: EmbeddingService,
    private readonly vectors: KbVectorStore,
  ) {}

  /** `organizationId` (opcional) agrega una segunda barrera de aislamiento además del kbId. */
  async search(
    kbId: string,
    query: string,
    topK = 5,
    organizationId?: string,
  ): Promise<ChunkResult[]> {
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embedding.embed(query);
    } catch (err) {
      // Embeddings caídos: degradar a búsqueda por texto (nunca vector de ceros)
      this.logger.warn(
        `Embeddings no disponibles, búsqueda por texto: ${String(err)}`,
      );
      return this.searchByText(kbId, query, topK, organizationId);
    }

    if (
      KbVectorStore.fits(queryEmbedding) &&
      (await this.vectors.isAvailable())
    ) {
      try {
        const hits = await this.vectors.search(
          kbId,
          queryEmbedding,
          topK,
          organizationId,
        );
        if (hits.length > 0) return hits;
        // Sin hits: puede ser una KB sin reindexar con pgvector → se prueba el respaldo en memoria
      } catch (err) {
        this.logger.warn(
          `pgvector falló, usando respaldo en memoria: ${String(err)}`,
        );
      }
    }

    return this.searchInMemory(
      kbId,
      queryEmbedding,
      topK,
      query,
      organizationId,
    );
  }

  // ── Respaldo en memoria (sin pgvector) ───────────────────────────────────

  private async searchInMemory(
    kbId: string,
    queryEmbedding: number[],
    topK: number,
    queryText: string,
    organizationId?: string,
  ): Promise<ChunkResult[]> {
    const chunks = await this.repo.listIndexedChunks(kbId, organizationId);

    // Solo vectores del mismo espacio (misma dimensión). Si el índice se generó con otro
    // modelo hay que reindexar: mientras tanto se responde por texto en vez de puntuar 0.
    const compatible = chunks.filter(
      (c) =>
        Array.isArray(c.embedding) &&
        (c.embedding as number[]).length === queryEmbedding.length,
    );
    if (compatible.length === 0) {
      if (chunks.length > 0) {
        this.logger.warn(
          `KB ${kbId}: vectores de otro modelo (${this.embedding.modelName}); reindexar. Búsqueda por texto.`,
        );
      }
      return this.searchByText(kbId, queryText, topK, organizationId);
    }

    return compatible
      .map((c) => ({
        chunkId: c.id,
        documentId: c.documentId,
        documentTitle: c.document.title,
        content: c.content,
        score: this.embedding.cosineSimilarity(
          queryEmbedding,
          c.embedding as number[],
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  // ── Degradación: búsqueda por texto (sin embeddings) ──────────────────────

  private async searchByText(
    kbId: string,
    queryText: string,
    topK: number,
    organizationId?: string,
  ): Promise<ChunkResult[]> {
    const terms = [
      ...new Set(
        queryText
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter((t) => t.length >= 4),
      ),
    ].slice(0, 6);
    if (terms.length === 0) return [];

    const chunks = await this.repo.searchChunksByText(
      kbId,
      terms,
      organizationId,
      50,
    );

    return chunks
      .map((c) => {
        const content = c.content.toLowerCase();
        const hits = terms.filter((t) => content.includes(t)).length;
        return {
          chunkId: c.id,
          documentId: c.documentId,
          documentTitle: c.document.title,
          content: c.content,
          score: hits / terms.length,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}
