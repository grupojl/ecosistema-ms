// chatia-backend/src/infrastructure/prisma/repositories/prisma-knowledge.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
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
import type {
  ChunkRowToStore,
  ChunkWithTitle,
  DocumentStatusUpdate,
  IKnowledgeRepository,
  KbStats,
  KnowledgeBaseWithCount,
} from '@/core/faq/repository/knowledge.repository.interface.js';

@Injectable()
export class PrismaKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Bases de conocimiento ────────────────────────────────────────────────

  async projectBelongsTo(
    projectId: string,
    organizationId: string,
  ): Promise<boolean> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    return project !== null;
  }

  createKnowledgeBase(
    data: CreateKnowledgeBaseInput & {
      projectId: string;
      organizationId: string;
    },
  ): Promise<KnowledgeBase> {
    return this.prisma.knowledgeBase.create({ data });
  }

  listKnowledgeBases(
    projectId: string,
    organizationId: string,
  ): Promise<KnowledgeBaseWithCount[]> {
    return this.prisma.knowledgeBase.findMany({
      where: { projectId, organizationId },
      include: { _count: { select: { documents: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findKnowledgeBase(
    kbId: string,
    organizationId: string,
  ): Promise<KnowledgeBaseWithCount | null> {
    return this.prisma.knowledgeBase.findFirst({
      where: { id: kbId, organizationId },
      include: { _count: { select: { documents: true } } },
    });
  }

  updateKnowledgeBase(
    kbId: string,
    data: UpdateKnowledgeBaseInput,
  ): Promise<KnowledgeBase> {
    return this.prisma.knowledgeBase.update({ where: { id: kbId }, data });
  }

  async deleteKnowledgeBase(kbId: string): Promise<void> {
    await this.prisma.knowledgeBase.delete({ where: { id: kbId } });
  }

  async getStats(kbId: string): Promise<KbStats> {
    const [total, byStatus, chunks] = await Promise.all([
      this.prisma.kbDocument.count({ where: { knowledgeBaseId: kbId } }),
      this.prisma.kbDocument.groupBy({
        by: ['status'],
        where: { knowledgeBaseId: kbId },
        _count: { id: true },
      }),
      this.prisma.kbChunk.count({
        where: { document: { knowledgeBaseId: kbId } },
      }),
    ]);
    return { total, byStatus, chunks };
  }

  countActiveKnowledgeBases(organizationId: string): Promise<number> {
    return this.prisma.knowledgeBase.count({
      where: { organizationId, isActive: true },
    });
  }

  // ── Documentos ───────────────────────────────────────────────────────────

  createDocument(
    data: CreateKbDocumentInput & {
      knowledgeBaseId: string;
      organizationId: string;
    },
  ): Promise<KbDocument> {
    return this.prisma.kbDocument.create({
      data: { ...data, status: 'PENDING' },
    });
  }

  listDocuments(
    kbId: string,
    organizationId: string,
    status?: KbDocumentStatus,
  ): Promise<KbDocument[]> {
    return this.prisma.kbDocument.findMany({
      where: {
        knowledgeBaseId: kbId,
        organizationId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findDocument(
    documentId: string,
    organizationId: string,
  ): Promise<KbDocument | null> {
    return this.prisma.kbDocument.findFirst({
      where: { id: documentId, organizationId },
    });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.prisma.kbDocument.delete({ where: { id: documentId } });
  }

  async resetDocumentForReindex(documentId: string): Promise<void> {
    await this.prisma.kbChunk.deleteMany({ where: { documentId } });
    await this.prisma.kbDocument.update({
      where: { id: documentId },
      data: {
        status: 'PENDING',
        chunkCount: 0,
        errorMessage: null,
        indexedAt: null,
      },
    });
  }

  async markProcessing(documentId: string): Promise<void> {
    await this.prisma.kbDocument.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null },
    });
  }

  async markFailed(
    documentId: string,
    organizationId: string,
    message: string,
  ): Promise<void> {
    await this.prisma.kbDocument.updateMany({
      where: { id: documentId, organizationId },
      data: { status: 'FAILED', errorMessage: message.slice(0, 500) },
    });
  }

  async applyStatus(
    documentId: string,
    organizationId: string,
    update: DocumentStatusUpdate,
  ): Promise<void> {
    // updateMany con organizationId: un servicio interno no puede tocar documentos de otra organización
    await this.prisma.kbDocument.updateMany({
      where: { id: documentId, organizationId },
      data: {
        status: update.status,
        ...(update.chunksIndexed !== undefined && {
          chunkCount: update.chunksIndexed,
        }),
        ...(update.status === 'INDEXED' && {
          indexedAt: new Date(),
          errorMessage: null,
        }),
        ...(update.error && { errorMessage: update.error.slice(0, 500) }),
      },
    });
  }

  // ── Fragmentos ───────────────────────────────────────────────────────────

  async replaceChunks(
    documentId: string,
    rows: ChunkRowToStore[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.kbChunk.deleteMany({ where: { documentId } }),
      this.prisma.kbChunk.createMany({
        data: rows.map((r) => ({
          documentId,
          content: r.content,
          chunkIndex: r.chunkIndex,
          embeddingModel: r.embeddingModel,
          metadata: { tokenCount: r.tokenCount },
          ...(r.embedding ? { embedding: r.embedding } : {}),
        })),
      }),
    ]);
  }

  async markIndexed(documentId: string, chunkCount: number): Promise<void> {
    await this.prisma.kbDocument.update({
      where: { id: documentId },
      data: {
        status: 'INDEXED',
        chunkCount,
        indexedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async storeJsonEmbeddings(
    documentId: string,
    rows: Array<{ chunkIndex: number; embedding: number[] }>,
  ): Promise<void> {
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.kbChunk.updateMany({
          where: { documentId, chunkIndex: r.chunkIndex },
          data: { embedding: r.embedding },
        }),
      ),
    );
  }

  listIndexedChunks(
    kbId: string,
    organizationId?: string,
  ): Promise<ChunkWithTitle[]> {
    return this.prisma.kbChunk.findMany({
      where: {
        document: {
          knowledgeBaseId: kbId,
          status: 'INDEXED',
          ...(organizationId ? { organizationId } : {}),
        },
      },
      include: { document: { select: { title: true } } },
    });
  }

  searchChunksByText(
    kbId: string,
    terms: string[],
    organizationId: string | undefined,
    take: number,
  ): Promise<ChunkWithTitle[]> {
    return this.prisma.kbChunk.findMany({
      where: {
        document: {
          knowledgeBaseId: kbId,
          status: 'INDEXED',
          ...(organizationId ? { organizationId } : {}),
        },
        OR: terms.map((term) => ({
          content: { contains: term, mode: 'insensitive' as const },
        })),
      },
      include: { document: { select: { title: true } } },
      take,
    });
  }
}
