import { FaqQueryService } from '@/core/faq/query/faq-query.service.js';
import {
  EMBEDDING_DIM,
  KbVectorStore,
} from '@/core/faq/vector/kb-vector.store.js';

describe('FaqQueryService', () => {
  const repo = {
    listIndexedChunks: jest.fn(),
    searchChunksByText: jest.fn(),
  };
  const embedding = {
    embed: jest.fn(),
    cosineSimilarity: jest.fn(),
    modelName: 'BAAI/bge-m3',
  };
  const vectors = { isAvailable: jest.fn(), search: jest.fn() };
  let svc: FaqQueryService;

  const chunk = (id: string, content: string, vec: number[] | null) => ({
    id,
    documentId: `doc-${id}`,
    content,
    embedding: vec,
    document: { title: `Doc ${id}` },
  });
  const bigVector = (): number[] =>
    Array.from({ length: EMBEDDING_DIM }, () => 0.01);

  beforeEach(() => {
    jest.clearAllMocks();
    vectors.isAvailable.mockResolvedValue(false); // por defecto: sin pgvector
    embedding.cosineSimilarity.mockImplementation((a: number[], b: number[]) =>
      a.length === b.length ? a[0]! * b[0]! : 0,
    );
    svc = new FaqQueryService(
      repo as never,
      embedding as never,
      vectors as never,
    );
  });

  it('ordena por similitud (respaldo en memoria) y respeta topK', async () => {
    embedding.embed.mockResolvedValue([1, 0]);
    repo.listIndexedChunks.mockResolvedValue([
      chunk('a', 'A', [0.2, 0]),
      chunk('b', 'B', [0.9, 0]),
      chunk('c', 'C', [0.5, 0]),
    ]);
    const res = await svc.search('kb-1', 'pregunta', 2);
    expect(res.map((r) => r.chunkId)).toEqual(['b', 'c']);
  });

  it('si el servicio de embeddings cae, responde por búsqueda de texto (no con ceros)', async () => {
    embedding.embed.mockRejectedValue(new Error('proveedores caídos'));
    repo.searchChunksByText.mockResolvedValue([
      chunk('a', 'Requisitos para renovar el registro de conducir', null),
      chunk('b', 'Horarios de atención al público', null),
    ]);
    const res = await svc.search('kb-1', 'como renovar registro conducir', 5);
    expect(res[0]!.chunkId).toBe('a');
    expect(res[0]!.score).toBeGreaterThan(0);
    const [kbId, terms] = repo.searchChunksByText.mock.calls[0] as [
      string,
      string[],
    ];
    expect(kbId).toBe('kb-1'); // aislado a la base de conocimiento pedida
    expect(terms.length).toBeGreaterThan(0);
    expect(repo.listIndexedChunks).not.toHaveBeenCalled();
  });

  it('vectores de otro modelo (otra dimensión) → reindexar y degradar a texto, no puntuar 0', async () => {
    embedding.embed.mockResolvedValue([1, 0, 0]); // 3 dims
    repo.listIndexedChunks.mockResolvedValue([chunk('a', 'texto', [0.5, 0])]); // 2 dims: incompatible
    repo.searchChunksByText.mockResolvedValue([
      chunk('a', 'texto sobre registro', [0.5, 0]),
    ]); // búsqueda por texto
    const res = await svc.search('kb-1', 'registro conducir');
    expect(res).toHaveLength(1);
    expect(repo.listIndexedChunks).toHaveBeenCalledTimes(1);
    expect(repo.searchChunksByText).toHaveBeenCalledTimes(1);
  });

  it('consultas sin palabras útiles (todas cortas) devuelven vacío sin tocar la base', async () => {
    embedding.embed.mockRejectedValue(new Error('x'));
    await expect(svc.search('kb-1', 'a de la')).resolves.toEqual([]);
    expect(repo.listIndexedChunks).not.toHaveBeenCalled();
    expect(repo.searchChunksByText).not.toHaveBeenCalled();
  });

  describe('con pgvector', () => {
    beforeEach(() => {
      vectors.isAvailable.mockResolvedValue(true);
      embedding.embed.mockResolvedValue(bigVector());
    });

    it('usa el índice y no carga fragmentos en memoria', async () => {
      const hit = {
        chunkId: 'x',
        documentId: 'd',
        documentTitle: 'T',
        content: 'C',
        score: 0.91,
      };
      vectors.search.mockResolvedValue([hit]);
      await expect(svc.search('kb-1', 'algo', 5, 'org-1')).resolves.toEqual([
        hit,
      ]);
      expect(vectors.search).toHaveBeenCalledWith(
        'kb-1',
        expect.any(Array),
        5,
        'org-1',
      );
      expect(repo.listIndexedChunks).not.toHaveBeenCalled();
    });

    it('si pgvector falla, cae al respaldo en memoria (no revienta la conversación)', async () => {
      vectors.search.mockRejectedValue(new Error('operator does not exist'));
      repo.listIndexedChunks.mockResolvedValue([chunk('a', 'A', bigVector())]);
      const res = await svc.search('kb-1', 'algo');
      expect(res).toHaveLength(1);
    });

    it('un vector de otra dimensión nunca se manda a pgvector (la columna es de 1024)', async () => {
      embedding.embed.mockResolvedValue([1, 0, 0]);
      repo.listIndexedChunks.mockResolvedValue([]);
      repo.searchChunksByText.mockResolvedValue([]);
      await svc.search('kb-1', 'registro conducir');
      expect(vectors.search).not.toHaveBeenCalled();
    });

    it('pasa el organizationId a la búsqueda y a los respaldos (segunda barrera de aislamiento)', async () => {
      vectors.search.mockResolvedValue([]);
      repo.listIndexedChunks.mockResolvedValue([chunk('a', 'A', bigVector())]);
      await svc.search('kb-1', 'algo', 5, 'org-1');
      expect(repo.listIndexedChunks).toHaveBeenCalledWith('kb-1', 'org-1');
    });
  });

  it('KbVectorStore.fits valida la dimensión de la columna', () => {
    expect(KbVectorStore.fits(bigVector())).toBe(true);
    expect(KbVectorStore.fits([1, 2, 3])).toBe(false);
    expect(KbVectorStore.fits(new Array(768).fill(0))).toBe(false); // nomic (el modelo anterior de workers)
  });
});
