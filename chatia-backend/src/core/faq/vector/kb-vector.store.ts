// src/core/faq/vector/kb-vector.store.ts
//
// Lógica del índice vectorial (pgvector): disponibilidad con caché, validación de dimensión y degradación.
// El SQL vive en infrastructure (IKbVectorRepository). Si el Postgres no tiene pgvector (la migración no falla
// en ese caso) todo esto se desactiva solo y la FAQ sigue con la búsqueda en memoria / por texto.
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  KB_VECTOR_REPOSITORY,
  type IKbVectorRepository,
} from '@/core/faq/repository/kb-vector.repository.interface.js';

/** Dimensión de la columna (BAAI/bge-m3). Otro modelo con otra dimensión requiere otra columna/migración. */
export const EMBEDDING_DIM = 1024;

const AVAILABILITY_TTL_MS = 60_000;

export interface VectorHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
}

export const toVectorLiteral = (vector: number[]): string =>
  `[${vector.join(',')}]`;

@Injectable()
export class KbVectorStore {
  private readonly logger = new Logger(KbVectorStore.name);
  private cached: { value: boolean; at: number } | null = null;

  constructor(
    @Inject(KB_VECTOR_REPOSITORY) private readonly repo: IKbVectorRepository,
  ) {}

  /** ¿Existe la columna vectorial? Se re-chequea cada minuto (se puede habilitar sin reiniciar). */
  async isAvailable(now = Date.now()): Promise<boolean> {
    if (this.cached && now - this.cached.at < AVAILABILITY_TTL_MS)
      return this.cached.value;
    let value = false;
    try {
      value = await this.repo.hasVectorColumn();
    } catch (err) {
      this.logger.warn(`No se pudo verificar pgvector: ${String(err)}`);
    }
    this.cached = { value, at: now };
    return value;
  }

  /** Dimensión válida para la columna: otra dimensión no se puede guardar ni comparar. */
  static fits(vector: number[]): boolean {
    return vector.length === EMBEDDING_DIM;
  }

  /** Guarda los vectores de los fragmentos de un documento (por chunkIndex). Devuelve false si no se pudo. */
  async writeVectors(
    documentId: string,
    rows: Array<{ chunkIndex: number; vector: number[] }>,
    model: string,
  ): Promise<boolean> {
    const writable = rows.filter((r) => KbVectorStore.fits(r.vector));
    if (writable.length === 0 || !(await this.isAvailable())) return false;
    try {
      await this.repo.writeVectors(
        documentId,
        writable.map((r) => ({
          chunkIndex: r.chunkIndex,
          literal: toVectorLiteral(r.vector),
        })),
        model,
      );
      return true;
    } catch (err) {
      this.cached = null; // re-verificar disponibilidad en el próximo uso
      this.logger.error(
        `No se pudieron guardar vectores pgvector del documento ${documentId}: ${String(err)}`,
      );
      return false;
    }
  }

  /** Los topK fragmentos más parecidos (coseno) de una base de conocimiento, usando el índice HNSW. */
  async search(
    kbId: string,
    vector: number[],
    topK: number,
    organizationId?: string,
  ): Promise<VectorHit[]> {
    return this.repo.searchByVector(
      kbId,
      toVectorLiteral(vector),
      topK,
      organizationId,
    );
  }
}
