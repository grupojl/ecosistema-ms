import { createServer } from 'node:net';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import {
  credentials,
  loadPackageDefinition,
  Metadata,
  status as GrpcStatus,
  type ServiceError,
} from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { CHATIA_PROTO_PATH } from '@ecosistema-ms/proto';
import { ChatiaGrpcController } from '@/infrastructure/transport/grpc/chatia-grpc.controller.js';
import { AssistantChatService } from '@/core/assistant/chat/assistant-chat.service.js';
import { FaqIngestionService } from '@/core/faq/ingestion/faq-ingestion.service.js';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';

type Callable = (
  req: object,
  meta: Metadata,
  cb: (err: ServiceError | null, res?: Record<string, unknown>) => void,
) => void;

const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const srv = createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });

describe('ChatIaService gRPC (contrato real con chatia.proto)', () => {
  const chat = { chat: jest.fn() };
  const ingestion = {
    upsertChunks: jest.fn(),
    updateDocumentStatus: jest.fn(),
  };
  const prisma = { project: { findFirst: jest.fn() } };
  let app: INestApplication;
  let client: Record<string, Callable>;
  let port: number;

  const call = (
    method: string,
    req: object,
    meta = new Metadata(),
  ): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      client[method]!(req, meta, (err, res) =>
        err ? reject(err) : resolve(res ?? {}),
      );
    });

  beforeAll(async () => {
    port = await freePort();
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatiaGrpcController],
      providers: [
        { provide: AssistantChatService, useValue: chat },
        { provide: FaqIngestionService, useValue: ingestion },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.GRPC,
      options: {
        package: 'chatia',
        protoPath: CHATIA_PROTO_PATH,
        url: `127.0.0.1:${port}`,
      },
    });
    await app.startAllMicroservices();
    await app.init();

    const definition = loadSync(CHATIA_PROTO_PATH);
    const pkg = loadPackageDefinition(definition) as unknown as {
      chatia: {
        ChatIaService: new (a: string, c: unknown) => Record<string, Callable>;
      };
    };
    client = new pkg.chatia.ChatIaService(
      `127.0.0.1:${port}`,
      credentials.createInsecure(),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env['GRPC_AUTH_ENFORCED'];
    delete process.env['INTERNAL_API_KEY'];
  });

  it('el proto expone todos los métodos que implementa el controller', () => {
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(client))).toEqual(
      expect.arrayContaining([
        'Ping',
        'GetProject',
        'SendMessage',
        'UpsertChunks',
        'UpdateDocumentStatus',
      ]),
    );
  });

  it('Ping responde ok (antes: UNIMPLEMENTED)', async () => {
    const res = await call('Ping', { caller: 'test' });
    expect(res['status']).toBe('ok');
  });

  it('SendMessage llama al asistente con los campos del proto', async () => {
    chat.chat.mockResolvedValue({
      sessionId: 'sess-1',
      response: 'Hola!',
      tokensUsed: 1,
      modelUsed: 'm',
      usedFaqFallback: false,
    });
    const res = await call('SendMessage', {
      organizationId: 'org-1',
      ecosystemId: 'eco-1',
      projectSlug: 'tramites',
      userId: 'u1',
      message: 'hola',
      channel: 'api',
    });
    expect(res).toMatchObject({
      success: true,
      conversationId: 'sess-1',
      response: 'Hola!',
    });
    expect(chat.chat).toHaveBeenCalledWith({
      projectSlug: 'tramites',
      organizationId: 'org-1',
      ecosystemId: 'eco-1',
      userId: 'u1',
      message: 'hola',
      channel: 'api',
    });
  });

  it('SendMessage con error de negocio responde success=false con el motivo (no cae el transporte)', async () => {
    chat.chat.mockRejectedValue(new Error('Proyecto no encontrado'));
    const res = await call('SendMessage', {
      organizationId: 'o',
      ecosystemId: 'e',
      userId: 'u',
      message: 'hola',
    });
    expect(res).toMatchObject({
      success: false,
      error: 'Proyecto no encontrado',
    });
  });

  it('argumentos inválidos → INVALID_ARGUMENT', async () => {
    const err = await call('SendMessage', {
      organizationId: '',
      message: '',
    }).catch((e: ServiceError) => e);
    expect((err as ServiceError).code).toBe(GrpcStatus.INVALID_ARGUMENT);
    expect(chat.chat).not.toHaveBeenCalled();
  });

  it('GetProject busca por organización + slug', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'p1',
      name: 'Trámites',
      assistantConfigs: [{ isEnabled: true }],
    });
    const res = await call('GetProject', {
      organizationId: 'org-1',
      projectSlug: 'tramites',
    });
    expect(res).toMatchObject({
      found: true,
      projectId: 'p1',
      name: 'Trámites',
      isEnabled: true,
    });
    expect(prisma.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', slug: 'tramites', isActive: true },
      }),
    );

    prisma.project.findFirst.mockResolvedValue(null);
    expect(
      await call('GetProject', { organizationId: 'org-1', projectSlug: 'x' }),
    ).toMatchObject({ found: false });
  });

  it('UpsertChunks (lo que llama workers) persiste los fragmentos con su vector', async () => {
    ingestion.upsertChunks.mockResolvedValue({ chunksStored: 2 });
    const res = await call('UpsertChunks', {
      documentId: 'doc-1',
      organizationId: 'org-1',
      knowledgeBaseId: 'kb-1',
      chunks: [
        {
          content: 'uno',
          embedding: [0.5, 0.25],
          chunkIndex: 0,
          tokenCount: 3,
        },
        { content: 'dos', embedding: [0.125, 1], chunkIndex: 1, tokenCount: 4 },
      ],
    });
    expect(res).toMatchObject({ success: true, chunksStored: 2 });
    const arg = ingestion.upsertChunks.mock.calls[0]![0] as {
      organizationId: string;
      chunks: Array<{ embedding: number[]; chunkIndex: number }>;
    };
    expect(arg.organizationId).toBe('org-1');
    expect(arg.chunks[1]).toMatchObject({
      chunkIndex: 1,
      embedding: [0.125, 1],
    });
  });

  it('UpsertChunks de un documento ajeno → NOT_FOUND', async () => {
    const notFound = Object.assign(new Error('Documento no encontrado'), {
      name: 'NotFoundException',
    });
    ingestion.upsertChunks.mockRejectedValue(notFound);
    const err = await call('UpsertChunks', {
      documentId: 'x',
      organizationId: 'org-OTRA',
      chunks: [{ content: 'a', embedding: [1], chunkIndex: 0, tokenCount: 1 }],
    }).catch((e: ServiceError) => e);
    expect((err as ServiceError).code).toBe(GrpcStatus.NOT_FOUND);
  });

  it('UpdateDocumentStatus valida el estado', async () => {
    ingestion.updateDocumentStatus.mockResolvedValue(undefined);
    expect(
      await call('UpdateDocumentStatus', {
        documentId: 'd',
        organizationId: 'o',
        status: 'INDEXED',
        chunksIndexed: 3,
      }),
    ).toMatchObject({ success: true });
    const err = await call('UpdateDocumentStatus', {
      documentId: 'd',
      organizationId: 'o',
      status: 'HACKED',
    }).catch((e: ServiceError) => e);
    expect((err as ServiceError).code).toBe(GrpcStatus.INVALID_ARGUMENT);
  });

  it('SendMessage: slug y canal vacíos del proto se traducen a "proyecto por defecto" y canal "api"', async () => {
    chat.chat.mockResolvedValue({ sessionId: 's', response: 'ok' });
    const base = { organizationId: 'o', ecosystemId: 'e', userId: 'u' };
    await call('SendMessage', {
      ...base,
      message: 'hola',
      projectSlug: '',
      channel: '',
    });
    await call('SendMessage', {
      ...base,
      message: 'hola',
      projectSlug: 'tramites',
      channel: 'whatsapp',
    });
    expect(chat.chat.mock.calls[0]?.[0]).toMatchObject({
      projectSlug: undefined,
      channel: 'api',
    });
    expect(chat.chat.mock.calls[1]?.[0]).toMatchObject({
      projectSlug: 'tramites',
      channel: 'whatsapp',
    });
  });

  it('SendMessage: un rechazo que no es un Error responde "Error interno" sin filtrar el valor', async () => {
    chat.chat.mockRejectedValue('texto crudo con detalles internos');
    const res = await call('SendMessage', {
      organizationId: 'o',
      ecosystemId: 'e',
      userId: 'u',
      message: 'hola',
    });
    expect(res).toMatchObject({ success: false, error: 'Error interno' });
  });

  it('GetProject: un proyecto sin asistente configurado existe pero NO está habilitado', async () => {
    prisma.project.findFirst.mockResolvedValue({
      id: 'p2',
      name: 'Sin asistente',
      assistantConfigs: [],
    });
    expect(
      await call('GetProject', {
        organizationId: 'org-1',
        projectSlug: 'sin-asistente',
      }),
    ).toMatchObject({ found: true, projectId: 'p2', isEnabled: false });
  });

  it('UpsertChunks: un fallo que no es "no encontrado" es INTERNAL; sin knowledgeBaseId se manda vacío', async () => {
    ingestion.upsertChunks.mockRejectedValue(new Error('pgvector caído'));
    const chunk = {
      content: 'a',
      embedding: [1],
      chunkIndex: 0,
      tokenCount: 1,
    };
    const err = await call('UpsertChunks', {
      documentId: 'd',
      organizationId: 'o',
      chunks: [chunk],
    }).catch((e: ServiceError) => e);
    expect((err as ServiceError).code).toBe(GrpcStatus.INTERNAL);
    expect(ingestion.upsertChunks.mock.calls[0]?.[0]).toMatchObject({
      knowledgeBaseId: '',
    });

    ingestion.upsertChunks.mockRejectedValue('cadena suelta');
    const err2 = await call('UpsertChunks', {
      documentId: 'd',
      organizationId: 'o',
      chunks: [chunk],
    }).catch((e: ServiceError) => e);
    expect((err2 as ServiceError).code).toBe(GrpcStatus.INTERNAL);
    expect((err2 as ServiceError).details).toContain('Error interno');
  });

  it('UpdateDocumentStatus: un estado FAILED viaja con su motivo', async () => {
    ingestion.updateDocumentStatus.mockResolvedValue(undefined);
    await call('UpdateDocumentStatus', {
      documentId: 'd',
      organizationId: 'o',
      status: 'FAILED',
      error: 'embedding timeout',
    });
    expect(ingestion.updateDocumentStatus).toHaveBeenCalledWith({
      documentId: 'd',
      organizationId: 'o',
      status: 'FAILED',
      chunksIndexed: undefined,
      error: 'embedding timeout',
    });
  });

  describe('GRPC_AUTH_ENFORCED=true', () => {
    beforeEach(() => {
      process.env['GRPC_AUTH_ENFORCED'] = 'true';
      process.env['INTERNAL_API_KEY'] = 'clave-interna-de-prueba';
    });

    it('sin clave → UNAUTHENTICATED', async () => {
      const err = await call('Ping', {}).catch((e: ServiceError) => e);
      expect((err as ServiceError).code).toBe(GrpcStatus.UNAUTHENTICATED);
    });

    it('con clave incorrecta → UNAUTHENTICATED', async () => {
      const meta = new Metadata();
      meta.set('x-internal-api-key', 'otra');
      const err = await call('Ping', {}, meta).catch((e: ServiceError) => e);
      expect((err as ServiceError).code).toBe(GrpcStatus.UNAUTHENTICATED);
    });

    it('con la clave correcta pasa', async () => {
      const meta = new Metadata();
      meta.set('x-internal-api-key', 'clave-interna-de-prueba');
      expect((await call('Ping', {}, meta))['status']).toBe('ok');
    });
  });
});
