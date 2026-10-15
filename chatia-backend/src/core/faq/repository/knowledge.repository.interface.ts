// chatia-backend/src/core/faq/repository/knowledge.repository.interface.ts
// Persistencia de la base de conocimiento: KnowledgeBase, KbDocument y KbChunk (un solo agregado).
import type {
  KbDocument,
  KbDocumentStatus,
  KnowledgeBase,
} from '@/generated/prisma/client.js';
import type {
  CreateKbDocumentInput,
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
} from '@/core/faq/schemas.js';

export const KNOWLEDGE_REPOSITORY = Symbol('KNOWLEDGE_REPOSITORY');

export type KnowledgeBaseWithCount = KnowledgeBase & {
  _count: { documents: number };
};

export interface KbStats {
  total: number;
  byStatus: Array<{ status: KbDocumentStatus; _count: { id: number } }>;
  chunks: number;
}

/** Fragmento con el título de su documento (resultado de búsqueda). */
export interface ChunkWithTitle {
  id: string;
  documentId: string;
  content: string;
  embedding: unknown;
  document: { title: string };
}

export interface ChunkRowToStore {
  content: string;
  chunkIndex: number;
  embeddingModel: string;
  tokenCount: number;
  /** Solo se guarda en la columna Json cuando no hay pgvector. */
  embedding?: number[];
}

export interface DocumentStatusUpdate {
  status: KbDocumentStatus;
  chunksIndexed?: number;
  error?: string;
}

export interface IKnowledgeRepository {
  // ── Bases de conocimiento ────────────────────────────────────────────────
  projectBelongsTo(projectId: string, organizationId: string): Promise<boolean>;
  createKnowledgeBase(
    data: CreateKnowledgeBaseInput & {
      projectId: string;
      organizationId: string;
    },
  ): Promise<KnowledgeBase>;
  listKnowledgeBases(
    projectId: string,
    organizationId: string,
  ): Promise<KnowledgeBaseWithCount[]>;
  findKnowledgeBase(
    kbId: string,
    organizationId: string,
  ): Promise<KnowledgeBaseWithCount | null>;
  updateKnowledgeBase(
    kbId: string,
    data: UpdateKnowledgeBaseInput,
  ): Promise<KnowledgeBase>;
  deleteKnowledgeBase(kbId: string): Promise<void>;
  getStats(kbId: string): Promise<KbStats>;
  countActiveKnowledgeBases(organizationId: string): Promise<number>;

  // ── Documentos ───────────────────────────────────────────────────────────
  createDocument(
    data: CreateKbDocumentInput & {
      knowledgeBaseId: string;
      organizationId: string;
    },
  ): Promise<KbDocument>;
  listDocuments(
    kbId: string,
    organizationId: string,
    status?: KbDocumentStatus,
  ): Promise<KbDocument[]>;
  findDocument(
    documentId: string,
    organizationId: string,
  ): Promise<KbDocument | null>;
  deleteDocument(documentId: string): Promise<void>;
  /** Borra los fragmentos y vuelve el documento a PENDING (re-indexación). */
  resetDocumentForReindex(documentId: string): Promise<void>;
  markProcessing(documentId: string): Promise<void>;
  /** Solo si el documento es de la organización (nunca se confía en el id a ciegas). */
  markFailed(
    documentId: string,
    organizationId: string,
    message: string,
  ): Promise<void>;
  applyStatus(
    documentId: string,
    organizationId: string,
    update: DocumentStatusUpdate,
  ): Promise<void>;

  // ── Fragmentos ───────────────────────────────────────────────────────────
  /** Reemplaza TODOS los fragmentos del documento (atómico). El estado INDEXED se marca después con markIndexed. */
  replaceChunks(documentId: string, rows: ChunkRowToStore[]): Promise<void>;
  /** El documento quedó indexado: estado INDEXED + cantidad de fragmentos + fecha. */
  markIndexed(documentId: string, chunkCount: number): Promise<void>;
  /** Respaldo Json de los vectores cuando pgvector no pudo guardarlos. */
  storeJsonEmbeddings(
    documentId: string,
    rows: Array<{ chunkIndex: number; embedding: number[] }>,
  ): Promise<void>;
  /** Fragmentos de documentos INDEXED de la KB (búsqueda en memoria). */
  listIndexedChunks(
    kbId: string,
    organizationId?: string,
  ): Promise<ChunkWithTitle[]>;
  /** Fragmentos que contienen alguno de los términos (búsqueda por texto, degradación sin embeddings). */
  searchChunksByText(
    kbId: string,
    terms: string[],
    organizationId: string | undefined,
    take: number,
  ): Promise<ChunkWithTitle[]>;
}
