import { FaqIngestionService } from '@/core/faq/ingestion/faq-ingestion.service.js';
import { FaqIngestionProcessor } from '@/core/faq/ingestion/faq-ingestion.processor.js';

describe('FaqIngestionService', () => {
  const queue = { add: jest.fn() };
  const repo = { markProcessing: jest.fn(), applyStatus: jest.fn() };
  const indexer = { replaceChunks: jest.fn() };
  let svc: FaqIngestionService;

  beforeEach(() => {
    jest.clearAllMocks();
    queue.add.mockResolvedValue({ id: 'job-9' });
    svc = new FaqIngestionService(
      queue as never,
      repo as never,
      indexer as never,
    );
  });

  it('enqueueIngest marca el documento y encola en workers con reintentos', async () => {
    const res = await svc.enqueueIngest({
      ecosystemId: 'eco',
      organizationId: 'org',
      documentId: 'd1',
      knowledgeBaseId: 'kb',
      source: 'TEXT',
      content: 'hola',
    });
    expect(res).toEqual({ jobId: 'job-9' });
    expect(repo.markProcessing).toHaveBeenCalledWith('d1');
    const [name, data, opts] = queue.add.mock.calls[0] as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(name).toBe('faq.ingest');
    expect(data).toMatchObject({ documentId: 'd1', organizationId: 'org' });
    expect(opts).toMatchObject({ attempts: 5 });
  });

  it('si la cola no devuelve id, el jobId es "unknown"', async () => {
    queue.add.mockResolvedValue({});
    const res = await svc.enqueueIngest({
      ecosystemId: 'e',
      organizationId: 'o',
      documentId: 'd',
      knowledgeBaseId: 'k',
      source: 'URL',
      content: 'https://x',
    });
    expect(res.jobId).toBe('unknown');
  });

  it('updateDocumentStatus (gRPC de workers) es SIEMPRE por organización', async () => {
    await svc.updateDocumentStatus({
      documentId: 'd1',
      organizationId: 'org',
      status: 'INDEXED',
      chunksIndexed: 7,
    });
    expect(repo.applyStatus).toHaveBeenCalledWith('d1', 'org', {
      status: 'INDEXED',
      chunksIndexed: 7,
      error: undefined,
    });
  });

  it('upsertChunks delega en el indexador (que valida la organización) y devuelve la cantidad', async () => {
    indexer.replaceChunks.mockResolvedValue(2);
    const chunks = [
      { content: 'a', embedding: [0.1], chunkIndex: 0, tokenCount: 1 },
      { content: 'b', embedding: [0.2], chunkIndex: 1, tokenCount: 1 },
    ];
    const res = await svc.upsertChunks({
      documentId: 'd1',
      organizationId: 'org',
      knowledgeBaseId: 'kb',
      chunks,
    });
    expect(res).toEqual({ chunksStored: 2 });
    expect(indexer.replaceChunks).toHaveBeenCalledWith('d1', 'org', chunks);
  });
});

describe('FaqIngestionProcessor', () => {
  const indexer = { indexDocument: jest.fn(), markFailed: jest.fn() };
  const job = (attemptsMade: number, attempts?: number) =>
    ({
      id: 'j1',
      data: { documentId: 'd1', organizationId: 'org' },
      attemptsMade,
      opts: attempts === undefined ? {} : { attempts },
    }) as never;
  let proc: FaqIngestionProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    indexer.markFailed.mockResolvedValue(undefined);
    proc = new FaqIngestionProcessor(indexer as never);
  });

  it('process indexa el documento de la organización del job', async () => {
    indexer.indexDocument.mockResolvedValue({ chunks: 3 });
    expect(await proc.process(job(0, 3))).toEqual({ chunks: 3 });
    expect(indexer.indexDocument).toHaveBeenCalledWith('d1', 'org');
  });

  it('un fallo intermedio NO marca FAILED (BullMQ reintenta)', async () => {
    await proc.onFailed(job(1, 3), new Error('x'));
    expect(indexer.markFailed).not.toHaveBeenCalled();
  });

  it('el último intento marca el documento FAILED con el motivo', async () => {
    await proc.onFailed(job(3, 3), new Error('sin contenido'));
    expect(indexer.markFailed).toHaveBeenCalledWith(
      'd1',
      'org',
      'sin contenido',
    );
  });

  it('sin opts.attempts, el primer fallo ya es el último', async () => {
    await proc.onFailed(job(1), new Error('x'));
    expect(indexer.markFailed).toHaveBeenCalledTimes(1);
  });

  it('si no se puede marcar FAILED no lanza; y tolera un job indefinido', async () => {
    indexer.markFailed.mockRejectedValue(new Error('db'));
    await expect(
      proc.onFailed(job(3, 3), new Error('x')),
    ).resolves.toBeUndefined();
    await expect(
      proc.onFailed(undefined, new Error('x')),
    ).resolves.toBeUndefined();
  });
});
