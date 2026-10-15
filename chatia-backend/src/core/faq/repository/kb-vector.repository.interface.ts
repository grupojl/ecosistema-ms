// chatia-backend/src/core/faq/repository/kb-vector.repository.interface.ts
// Acceso a la columna pgvector de KbChunk. Prisma no lee tipos Unsupported, así que la implementación usa SQL
// crudo (infrastructure/prisma/repositories/prisma-kb-vector.repository.ts). core/ solo ve esta interface.
export const KB_VECTOR_REPOSITORY = Symbol('KB_VECTOR_REPOSITORY');

export interface VectorRow {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
}

export interface IKbVectorRepository {
  /** ¿Existe la columna vectorial "embeddingVec"? (false si el Postgres no tiene pgvector) */
  hasVectorColumn(): Promise<boolean>;
  /** Guarda los vectores (literales `[0.1,0.2,…]`) por chunkIndex, en una sola transacción. */
  writeVectors(
    documentId: string,
    rows: Array<{ chunkIndex: number; literal: string }>,
    model: string,
  ): Promise<void>;
  /** Los topK fragmentos más parecidos (coseno) usando el índice HNSW. */
  searchByVector(
    kbId: string,
    literal: string,
    topK: number,
    organizationId?: string,
  ): Promise<VectorRow[]>;
}
