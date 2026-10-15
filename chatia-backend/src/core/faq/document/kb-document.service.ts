// src/core/faq/document/kb-document.service.ts
import { addWithTimeout } from '@/infrastructure/queue/add-with-timeout.js';
import {
  Inject,
  Injectable,
  NotFoundException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  KNOWLEDGE_REPOSITORY,
  type IKnowledgeRepository,
} from '@/core/faq/repository/knowledge.repository.interface.js';
import type { KbDocumentStatus } from '@/generated/prisma/client.js';
import type { CreateKbDocumentInput } from '@/core/faq/schemas.js';
import { QUEUES, JOBS } from '@/infrastructure/queue/queue.constants.js';

export interface IngestJobData {
  documentId: string;
  organizationId: string;
}

@Injectable()
export class KbDocumentService {
  private readonly logger = new Logger(KbDocumentService.name);

  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: IKnowledgeRepository,
    @Optional()
    @InjectQueue(QUEUES.FAQ_INGEST)
    private readonly ingestQueue: Queue<IngestJobData> | null,
  ) {}

  async create(
    kbId: string,
    organizationId: string,
    dto: CreateKbDocumentInput,
  ) {
    const kb = await this.repo.findKnowledgeBase(kbId, organizationId);
    if (!kb) throw new NotFoundException('Knowledge base no encontrada');

    const doc = await this.repo.createDocument({
      ...dto,
      knowledgeBaseId: kbId,
      organizationId,
    });

    await this.enqueueIngest(doc.id, organizationId);
    this.logger.log(
      `Documento creado${this.ingestQueue ? ' y encolado' : ' (ingesta deshabilitada sin Redis)'}: ${doc.id}`,
    );
    return { success: true, data: doc };
  }

  async findAll(kbId: string, organizationId: string, status?: string) {
    const docs = await this.repo.listDocuments(
      kbId,
      organizationId,
      status as KbDocumentStatus | undefined,
    );
    return { success: true, data: docs };
  }

  async reindex(documentId: string, organizationId: string) {
    const doc = await this.repo.findDocument(documentId, organizationId);
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.repo.resetDocumentForReindex(documentId);

    await this.enqueueIngest(documentId, organizationId);
    return {
      success: true,
      message: this.ingestQueue
        ? 'Re-indexación encolada'
        : 'Re-indexación no disponible sin Redis',
    };
  }

  async remove(documentId: string, organizationId: string) {
    const doc = await this.repo.findDocument(documentId, organizationId);
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.repo.deleteDocument(documentId);
    return { success: true, message: 'Documento eliminado' };
  }

  private async enqueueIngest(
    documentId: string,
    organizationId: string,
  ): Promise<void> {
    if (!this.ingestQueue) {
      this.logger.debug(
        `[no-op] ingesta ignorada (Redis deshabilitado): ${documentId}`,
      );
      return;
    }
    const ingestQueue = this.ingestQueue;
    await addWithTimeout(
      () =>
        ingestQueue.add(
          JOBS.FAQ_INGEST_DOCUMENT,
          { documentId, organizationId },
          {
            // jobId único por solicitud: con uno fijo, reindexar se ignoraba si el job anterior seguía guardado en Redis
            jobId: `ingest:${documentId}:${Date.now()}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        ),
      QUEUES.FAQ_INGEST,
    );
  }
}
