// chatia-backend/src/infrastructure/prisma/repositories/prisma-kb-vector.repository.ts
// SQL crudo sobre la columna pgvector de KbChunk ("embeddingVec"): Prisma no lee tipos Unsupported.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import type {
  IKbVectorRepository,
  VectorRow,
} from '@/core/faq/repository/kb-vector.repository.interface.js';

@Injectable()
export class PrismaKbVectorRepository implements IKbVectorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async hasVectorColumn(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<unknown[]>`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'KbChunk' AND column_name = 'embeddingVec'
    `;
    return rows.length > 0;
  }

  async writeVectors(
    documentId: string,
    rows: Array<{ chunkIndex: number; literal: string }>,
    model: string,
  ): Promise<void> {
    await this.prisma.$transaction(
      rows.map(
        (r) => this.prisma.$executeRaw`
          UPDATE "KbChunk"
          SET "embeddingVec" = ${r.literal}::vector, "embeddingModel" = ${model}
          WHERE "documentId" = ${documentId} AND "chunkIndex" = ${r.chunkIndex}
        `,
      ),
    );
  }

  async searchByVector(
    kbId: string,
    literal: string,
    topK: number,
    organizationId?: string,
  ): Promise<VectorRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        document_id: string;
        document_title: string;
        content: string;
        score: number;
      }>
    >`
      SELECT c.id,
             c."documentId" AS document_id,
             d.title        AS document_title,
             c.content,
             1 - (c."embeddingVec" <=> ${literal}::vector) AS score
      FROM "KbChunk" c
      JOIN "KbDocument" d ON d.id = c."documentId"
      WHERE d."knowledgeBaseId" = ${kbId}
        AND (${organizationId ?? null}::text IS NULL OR d."organizationId" = ${organizationId ?? null})
        AND d.status = 'INDEXED'
        AND c."embeddingVec" IS NOT NULL
      ORDER BY c."embeddingVec" <=> ${literal}::vector
      LIMIT ${topK}
    `;

    return rows.map((r) => ({
      chunkId: r.id,
      documentId: r.document_id,
      documentTitle: r.document_title,
      content: r.content,
      score: Number(r.score),
    }));
  }
}
