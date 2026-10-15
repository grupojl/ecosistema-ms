// src/core/faq/ingestion/faq-indexer.service.ts
//
// Indexación real de un documento de la base de conocimiento:
//   extraer texto → partir en fragmentos → vectorizar (lotes) → guardar (pgvector + respaldo Json) → INDEXED
//
// Antes: KbDocumentService encolaba en una cola local SIN consumidor y el procesador de workers-backend
// es un stub, así que ningún documento pasaba de PENDING. Esto lo hace funcionar dentro de chatia.
// Si en el futuro workers-backend implementa la extracción real, `replaceChunks` también lo usa su gRPC UpsertChunks.
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  KNOWLEDGE_REPOSITORY,
  type IKnowledgeRepository,
} from '@/core/faq/repository/knowledge.repository.interface.js';
import { EmbeddingService } from '@/infrastructure/common/services/embedding.service.js';
import { KbVectorStore } from '@/core/faq/vector/kb-vector.store.js';
import { chunkText } from '@/core/faq/ingestion/text-chunker.js';
import { fetchUrlText } from '@/core/faq/ingestion/safe-url-fetch.js';

export interface ChunkToStore {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  embedding: number[];
}

const MAX_CHUNKS_PER_DOCUMENT = 2_000;

@Injectable()
export class FaqIndexerService {
  private readonly logger = new Logger(FaqIndexerService.name);

  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: IKnowledgeRepository,
    private readonly embedding: EmbeddingService,
    private readonly vectors: KbVectorStore,
  ) {}

  async indexDocument(
    documentId: string,
    organizationId: string,
  ): Promise<{ chunks: number }> {
    const doc = await this.repo.findDocument(documentId, organizationId);
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.repo.markProcessing(documentId);

    const text = await this.extractText(doc);
    const chunks = chunkText(text);
    if (chunks.length === 0)
      throw new Error('El documento no tiene contenido para indexar');
    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
      throw new Error(
        `El documento es demasiado grande (${chunks.length} fragmentos; máximo ${MAX_CHUNKS_PER_DOCUMENT})`,
      );
    }

    const vectors = await this.embedding.embedMany(
      chunks.map((c) => c.content),
    );
    const stored = await this.replaceChunks(
      documentId,
      organizationId,
      chunks.map((c, i) => ({ ...c, embedding: vectors[i] })),
    );

    this.logger.log(
      `Documento ${documentId} indexado: ${stored} fragmentos (${this.embedding.modelName})`,
    );
    return { chunks: stored };
  }

  /** Marca el documento como fallido con un motivo legible para el usuario. */
  async markFailed(
    documentId: string,
    organizationId: string,
    message: string,
  ): Promise<void> {
    // el mensaje se muestra al usuario: se acota para no volcar trazas largas
    await this.repo.markFailed(
      documentId,
      organizationId,
      message.slice(0, 500),
    );
  }

  /**
   * Reemplaza TODOS los fragmentos del documento y lo deja INDEXED. Verifica que el documento sea de la
   * organización (también lo usa el gRPC de workers-backend: nunca se confía en el documentId a ciegas).
   */
  async replaceChunks(
    documentId: string,
    organizationId: string,
    chunks: ChunkToStore[],
  ): Promise<number> {
    const doc = await this.repo.findDocument(documentId, organizationId);
    if (!doc) throw new NotFoundException('Documento no encontrado');

    const model = this.embedding.modelName;
    const usePgvector = await this.vectors.isAvailable();

    await this.repo.replaceChunks(
      documentId,
      chunks.map((c) => ({
        content: c.content,
        chunkIndex: c.chunkIndex,
        embeddingModel: model,
        tokenCount: c.tokenCount,
        // Con pgvector el vector va a la columna indexada; el Json queda solo como respaldo sin pgvector
        ...(usePgvector ? {} : { embedding: c.embedding }),
      })),
    );

    if (usePgvector) {
      const written = await this.vectors.writeVectors(
        documentId,
        chunks.map((c) => ({ chunkIndex: c.chunkIndex, vector: c.embedding })),
        model,
      );
      if (!written) await this.storeJsonFallback(documentId, chunks);
    }

    await this.repo.markIndexed(documentId, chunks.length);
    return chunks.length;
  }

  /** pgvector no pudo guardar (dimensión distinta, extensión caída): se conserva el Json para no perder el índice. */
  private async storeJsonFallback(
    documentId: string,
    chunks: ChunkToStore[],
  ): Promise<void> {
    this.logger.warn(
      `Documento ${documentId}: guardando vectores en Json (respaldo)`,
    );
    await this.repo.storeJsonEmbeddings(
      documentId,
      chunks.map((c) => ({ chunkIndex: c.chunkIndex, embedding: c.embedding })),
    );
  }

  private async extractText(doc: {
    sourceType: string;
    rawContent: string | null;
    sourceUrl: string | null;
  }): Promise<string> {
    switch (doc.sourceType) {
      case 'TEXT':
      case 'MARKDOWN':
        if (!doc.rawContent?.trim())
          throw new Error('El documento no tiene texto');
        return doc.rawContent;
      case 'JSON':
        if (!doc.rawContent?.trim())
          throw new Error('El documento no tiene contenido JSON');
        return this.jsonToText(doc.rawContent);
      case 'URL':
        if (!doc.sourceUrl) throw new Error('El documento no tiene URL');
        return fetchUrlText(doc.sourceUrl);
      case 'PDF':
        throw new Error(
          'Los PDF todavía no se pueden procesar: pegá el texto del documento o usá una URL con HTML',
        );
      default:
        throw new Error(`Tipo de documento no soportado: ${doc.sourceType}`);
    }
  }

  /** JSON → líneas "ruta: valor" legibles (para que el contenido sea recuperable por significado). */
  private jsonToText(raw: string): string {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('El contenido JSON no es válido');
    }
    const lines: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (value === null || value === undefined) return;
      if (typeof value === 'object') {
        for (const [k, v] of Object.entries(value as Record<string, unknown>))
          walk(v, path ? `${path}.${k}` : k);
        return;
      }
      // Solo primitivos con texto útil (los objetos y null/undefined se resolvieron arriba)
      if (typeof value === 'string') lines.push(`${path}: ${value}`);
      else if (typeof value === 'number' || typeof value === 'boolean') {
        lines.push(`${path}: ${String(value)}`);
      }
    };
    walk(parsed, '');
    return lines.join('\n');
  }
}
