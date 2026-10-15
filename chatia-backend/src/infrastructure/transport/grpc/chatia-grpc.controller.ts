// src/infrastructure/transport/grpc/chatia-grpc.controller.ts
//
// Implementación del servicio gRPC `chatia.ChatIaService` (puerto 5010, red interna).
// ANTES chatia levantaba el servidor gRPC pero no implementaba ningún método: cualquier llamada
// devolvía UNIMPLEMENTED (y workers llamaba a `upsertChunks`, que ni estaba en el proto).
//
// Los campos llegan/salen en camelCase (proto-loader por defecto): organizationId, projectSlug, ...
import { Controller, Logger, UseGuards } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { z } from 'zod';
import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';
import { FaqIngestionService } from '@/core/faq/ingestion/faq-ingestion.service.js';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { GrpcAuthGuard } from '@/infrastructure/transport/grpc/grpc-auth.guard.js';

const SendMessageSchema = z.object({
  organizationId: z.string().min(1),
  ecosystemId: z.string().min(1),
  projectSlug: z.string().optional(),
  userId: z.string().min(1).max(200),
  message: z.string().trim().min(1).max(4000),
  channel: z.string().max(40).optional(),
});

const GetProjectSchema = z.object({
  organizationId: z.string().min(1),
  projectSlug: z.string().min(1),
});

const UpsertChunksSchema = z.object({
  documentId: z.string().min(1),
  organizationId: z.string().min(1),
  knowledgeBaseId: z.string().optional(),
  chunks: z
    .array(
      z.object({
        content: z.string().min(1),
        embedding: z.array(z.number()).min(1),
        chunkIndex: z.number().int().min(0),
        tokenCount: z.number().int().min(0).default(0),
      }),
    )
    .min(1)
    .max(2000),
});

const UpdateStatusSchema = z.object({
  documentId: z.string().min(1),
  organizationId: z.string().min(1),
  status: z.enum(['INDEXED', 'FAILED']),
  chunksIndexed: z.number().int().min(0).optional(),
  error: z.string().max(2000).optional(),
});

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('; ');
    throw new RpcException({
      code: GrpcStatus.INVALID_ARGUMENT,
      message: detail,
    });
  }
  return result.data;
}

@Controller()
@UseGuards(GrpcAuthGuard)
export class ChatiaGrpcController {
  private readonly logger = new Logger(ChatiaGrpcController.name);

  constructor(
    private readonly chat: AssistantChatService,
    private readonly ingestion: FaqIngestionService,
    private readonly prisma: PrismaService,
  ) {}

  @GrpcMethod('ChatIaService', 'Ping')
  ping(): { status: string; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @GrpcMethod('ChatIaService', 'GetProject')
  async getProject(data: unknown): Promise<{
    found: boolean;
    projectId: string;
    name: string;
    isEnabled: boolean;
  }> {
    const req = parse(GetProjectSchema, data);
    const project = await this.prisma.project.findFirst({
      where: {
        organizationId: req.organizationId,
        slug: req.projectSlug,
        isActive: true,
      },
      include: { assistantConfigs: { select: { isEnabled: true }, take: 1 } },
    });
    if (!project)
      return { found: false, projectId: '', name: '', isEnabled: false };
    return {
      found: true,
      projectId: project.id,
      name: project.name,
      isEnabled: project.assistantConfigs[0]?.isEnabled ?? false,
    };
  }

  @GrpcMethod('ChatIaService', 'SendMessage')
  async sendMessage(data: unknown): Promise<{
    success: boolean;
    conversationId: string;
    messageId: string;
    response: string;
    error: string;
  }> {
    const req = parse(SendMessageSchema, data);
    try {
      const result = await this.chat.chat({
        projectSlug: req.projectSlug || undefined,
        organizationId: req.organizationId,
        ecosystemId: req.ecosystemId,
        userId: req.userId,
        message: req.message,
        channel: req.channel || 'api',
      });
      return {
        success: true,
        conversationId: result.sessionId,
        messageId: '',
        response: result.response,
        error: '',
      };
    } catch (err) {
      // Error de negocio (proyecto inexistente, etc.): se informa en el cuerpo, no como falla de transporte
      this.logger.warn(
        `SendMessage falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        success: false,
        conversationId: '',
        messageId: '',
        response: '',
        error: err instanceof Error ? err.message : 'Error interno',
      };
    }
  }

  @GrpcMethod('ChatIaService', 'UpsertChunks')
  async upsertChunks(
    data: unknown,
  ): Promise<{ success: boolean; chunksStored: number; error: string }> {
    const req = parse(UpsertChunksSchema, data);
    try {
      const { chunksStored } = await this.ingestion.upsertChunks({
        documentId: req.documentId,
        organizationId: req.organizationId,
        knowledgeBaseId: req.knowledgeBaseId ?? '',
        chunks: req.chunks,
      });
      return { success: true, chunksStored, error: '' };
    } catch (err) {
      this.logger.error(
        `UpsertChunks falló (doc ${req.documentId}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new RpcException({
        code:
          err instanceof Error && err.name === 'NotFoundException'
            ? GrpcStatus.NOT_FOUND
            : GrpcStatus.INTERNAL,
        message: err instanceof Error ? err.message : 'Error interno',
      });
    }
  }

  @GrpcMethod('ChatIaService', 'UpdateDocumentStatus')
  async updateDocumentStatus(
    data: unknown,
  ): Promise<{ success: boolean; error: string }> {
    const req = parse(UpdateStatusSchema, data);
    await this.ingestion.updateDocumentStatus({
      documentId: req.documentId,
      organizationId: req.organizationId,
      status: req.status,
      chunksIndexed: req.chunksIndexed,
      error: req.error,
    });
    return { success: true, error: '' };
  }
}
