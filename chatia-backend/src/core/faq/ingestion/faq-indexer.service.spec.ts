import { NotFoundException } from '@nestjs/common';
import { FaqIndexerService } from '@/core/faq/ingestion/faq-indexer.service.js';

describe('FaqIndexerService', () => {
  const repo = {
    findDocument: jest.fn(),
    markProcessing: jest.fn(),
    markFailed: jest.fn(),
    replaceChunks: jest.fn(),
    markIndexed: jest.fn(),
    storeJsonEmbeddings: jest.fn(),
  };
  const embedding = { embedMany: jest.fn(), modelName: 'BAAI/bge-m3' };
  const vectors = { isAvailable: jest.fn(), writeVectors: jest.fn() };
  let svc: FaqIndexerService;

  const doc = (over: Record<string, unknown> = {}) => ({
    id: 'doc-1',
    organizationId: 'org-1',
    sourceType: 'TEXT',
    rawContent: 'Primer párrafo.\n\nSegundo párrafo.',
    sourceUrl: null,
    ...over,
  });
  const storedRows = (): Array<Record<string, unknown>> =>
    repo.replaceChunks.mock.calls[0]![1] as Array<Record<string, unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findDocument.mockResolvedValue(doc());
    embedding.embedMany.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => [0.1, 0.2])),
    );
    vectors.isAvailable.mockResolvedValue(false);
    svc = new FaqIndexerService(
      repo as never,
      embedding as never,
      vectors as never,
    );
  });

  it('indexa un documento de texto: PROCESSING → fragmentos → INDEXED', async () => {
    const res = await svc.indexDocument('doc-1', 'org-1');
    expect(res.chunks).toBeGreaterThan(0);
    expect(repo.markProcessing).toHaveBeenCalledWith('doc-1');
    expect(repo.replaceChunks).toHaveBeenCalledTimes(1);
    expect(repo.markIndexed).toHaveBeenCalledWith('doc-1', res.chunks);
    // el orden importa: fragmentos primero, estado INDEXED al final
    expect(repo.replaceChunks.mock.invocationCallOrder[0]).toBeLessThan(
      repo.markIndexed.mock.invocationCallOrder[0]!,
    );
  });

  it('un documento de OTRA organización no se procesa', async () => {
    repo.findDocument.mockResolvedValue(null);
    await expect(svc.indexDocument('doc-1', 'org-OTRA')).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.findDocument).toHaveBeenCalledWith('doc-1', 'org-OTRA');
    expect(embedding.embedMany).not.toHaveBeenCalled();
    expect(repo.markProcessing).not.toHaveBeenCalled();
  });

  it('sin pgvector guarda el vector en el Json de respaldo', async () => {
    await svc.indexDocument('doc-1', 'org-1');
    expect(storedRows()[0]).toMatchObject({
      embedding: [0.1, 0.2],
      embeddingModel: 'BAAI/bge-m3',
    });
    expect(vectors.writeVectors).not.toHaveBeenCalled();
  });

  it('con pgvector escribe en la columna indexada y no duplica el Json', async () => {
    vectors.isAvailable.mockResolvedValue(true);
    vectors.writeVectors.mockResolvedValue(true);
    await svc.indexDocument('doc-1', 'org-1');
    expect(storedRows()[0]).not.toHaveProperty('embedding');
    expect(vectors.writeVectors).toHaveBeenCalledWith(
      'doc-1',
      expect.any(Array),
      'BAAI/bge-m3',
    );
    expect(repo.storeJsonEmbeddings).not.toHaveBeenCalled();
    // el estado INDEXED se marca DESPUÉS de escribir los vectores
    expect(vectors.writeVectors.mock.invocationCallOrder[0]).toBeLessThan(
      repo.markIndexed.mock.invocationCallOrder[0]!,
    );
  });

  it('si pgvector no pudo guardar, conserva los vectores en Json (no pierde el índice)', async () => {
    vectors.isAvailable.mockResolvedValue(true);
    vectors.writeVectors.mockResolvedValue(false);
    await svc.indexDocument('doc-1', 'org-1');
    expect(repo.storeJsonEmbeddings).toHaveBeenCalledWith(
      'doc-1',
      expect.arrayContaining([
        expect.objectContaining({ embedding: [0.1, 0.2] }),
      ]),
    );
  });

  it('documento sin contenido → error claro', async () => {
    repo.findDocument.mockResolvedValue(doc({ rawContent: '   ' }));
    await expect(svc.indexDocument('doc-1', 'org-1')).rejects.toThrow(
      /no tiene texto/,
    );
  });

  it('los PDF explican qué hacer en vez de fallar en silencio', async () => {
    repo.findDocument.mockResolvedValue(doc({ sourceType: 'PDF' }));
    await expect(svc.indexDocument('doc-1', 'org-1')).rejects.toThrow(/PDF/);
  });

  it('tipos no soportados y URL sin dirección dan error claro', async () => {
    repo.findDocument.mockResolvedValue(doc({ sourceType: 'DOCX' }));
    await expect(svc.indexDocument('doc-1', 'org-1')).rejects.toThrow(
      /no soportado/,
    );
    repo.findDocument.mockResolvedValue(
      doc({ sourceType: 'URL', sourceUrl: null }),
    );
    await expect(svc.indexDocument('doc-1', 'org-1')).rejects.toThrow(/URL/);
  });

  it('JSON se aplana a líneas "ruta: valor"', async () => {
    repo.findDocument.mockResolvedValue(
      doc({
        sourceType: 'JSON',
        rawContent:
          '{"horario":{"lunes":"8 a 14"},"tel":"4444","n":3,"ok":true}',
      }),
    );
    await svc.indexDocument('doc-1', 'org-1');
    const content = storedRows()[0]!['content'] as string;
    expect(content).toContain('horario.lunes: 8 a 14');
    expect(content).toContain('tel: 4444');
    expect(content).toContain('n: 3');
    expect(content).toContain('ok: true');
  });

  it('JSON inválido o vacío → error claro', async () => {
    repo.findDocument.mockResolvedValue(
      doc({ sourceType: 'JSON', rawContent: '{no es json' }),
    );
    await expect(svc.indexDocument('doc-1', 'org-1')).rejects.toThrow(
      /JSON no es válido/,
    );
    repo.findDocument.mockResolvedValue(
      doc({ sourceType: 'JSON', rawContent: ' ' }),
    );
    await expect(svc.indexDocument('doc-1', 'org-1')).rejects.toThrow(
      /contenido JSON/,
    );
  });

  it('si los embeddings fallan el error sube (BullMQ reintenta) y no se guarda nada a medias', async () => {
    embedding.embedMany.mockRejectedValue(new Error('proveedores caídos'));
    await expect(svc.indexDocument('doc-1', 'org-1')).rejects.toThrow(
      'proveedores caídos',
    );
    expect(repo.replaceChunks).not.toHaveBeenCalled();
    expect(repo.markIndexed).not.toHaveBeenCalled();
  });

  it('markFailed acota el mensaje a 500 caracteres y es por organización', async () => {
    await svc.markFailed('doc-1', 'org-1', 'x'.repeat(900));
    const [id, org, msg] = repo.markFailed.mock.calls[0] as [
      string,
      string,
      string,
    ];
    expect([id, org]).toEqual(['doc-1', 'org-1']);
    expect(msg).toHaveLength(500);
  });

  it('replaceChunks (usado también por gRPC) exige que el documento sea de la organización', async () => {
    repo.findDocument.mockResolvedValue(null);
    await expect(svc.replaceChunks('doc-1', 'org-OTRA', [])).rejects.toThrow(
      NotFoundException,
    );
    expect(repo.replaceChunks).not.toHaveBeenCalled();
  });
});
