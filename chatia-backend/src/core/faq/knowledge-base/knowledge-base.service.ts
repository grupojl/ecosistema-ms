// src/core/faq/knowledge-base/knowledge-base.service.ts
import { Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  KNOWLEDGE_REPOSITORY,
  type IKnowledgeRepository,
} from '@/core/faq/repository/knowledge.repository.interface.js';
import type {
  CreateKnowledgeBaseInput,
  UpdateKnowledgeBaseInput,
} from '@/core/faq/schemas.js';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @Inject(KNOWLEDGE_REPOSITORY) private readonly repo: IKnowledgeRepository,
  ) {}

  async create(
    projectId: string,
    organizationId: string,
    dto: CreateKnowledgeBaseInput,
  ) {
    // El projectId viene del cliente: debe pertenecer a SU organización (si no, se podría colgar una KB en un proyecto ajeno)
    if (!(await this.repo.projectBelongsTo(projectId, organizationId)))
      throw new NotFoundException('Proyecto no encontrado');

    const kb = await this.repo.createKnowledgeBase({
      ...dto,
      projectId,
      organizationId,
    });
    this.logger.log(`KnowledgeBase creada: ${kb.id} en proyecto ${projectId}`);
    return { success: true, data: kb };
  }

  async findAll(projectId: string, organizationId: string) {
    const items = await this.repo.listKnowledgeBases(projectId, organizationId);
    return { success: true, data: items };
  }

  async findOne(kbId: string, organizationId: string) {
    const kb = await this.repo.findKnowledgeBase(kbId, organizationId);
    if (!kb) throw new NotFoundException('Knowledge base no encontrada');
    return kb;
  }

  async update(
    kbId: string,
    organizationId: string,
    dto: UpdateKnowledgeBaseInput,
  ) {
    await this.findOne(kbId, organizationId);
    return this.repo.updateKnowledgeBase(kbId, dto);
  }

  async remove(kbId: string, organizationId: string) {
    await this.findOne(kbId, organizationId);
    await this.repo.deleteKnowledgeBase(kbId);
    return { success: true, message: 'Knowledge base eliminada' };
  }

  async getStats(kbId: string, organizationId: string) {
    await this.findOne(kbId, organizationId);
    const { total, byStatus, chunks } = await this.repo.getStats(kbId);
    return {
      success: true,
      data: { totalDocuments: total, byStatus, totalChunks: chunks },
    };
  }
}
