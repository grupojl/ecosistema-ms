import {
  EMBEDDING_DIM,
  KbVectorStore,
  toVectorLiteral,
} from '@/core/faq/vector/kb-vector.store.js';

describe('KbVectorStore', () => {
  const repo = {
    hasVectorColumn: jest.fn(),
    writeVectors: jest.fn(),
    searchByVector: jest.fn(),
  };
  let store: KbVectorStore;
  const vec = (): number[] => new Array(EMBEDDING_DIM).fill(0.5);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.writeVectors.mockResolvedValue(undefined);
    store = new KbVectorStore(repo as never);
  });

  it('toVectorLiteral arma el literal de pgvector', () => {
    expect(toVectorLiteral([1, 2.5, -3])).toBe('[1,2.5,-3]');
  });

  describe('isAvailable', () => {
    it('true si la columna existe, y se cachea 60 s', async () => {
      repo.hasVectorColumn.mockResolvedValue(true);
      expect(await store.isAvailable(1_000)).toBe(true);
      expect(await store.isAvailable(30_000)).toBe(true);
      expect(repo.hasVectorColumn).toHaveBeenCalledTimes(1);
      await store.isAvailable(70_000); // venció
      expect(repo.hasVectorColumn).toHaveBeenCalledTimes(2);
    });

    it('false si la columna no existe (Postgres sin pgvector)', async () => {
      repo.hasVectorColumn.mockResolvedValue(false);
      expect(await store.isAvailable()).toBe(false);
    });

    it('false (sin romper) si la consulta falla', async () => {
      repo.hasVectorColumn.mockRejectedValue(new Error('db'));
      expect(await store.isAvailable()).toBe(false);
    });
  });

  describe('writeVectors', () => {
    it('no escribe nada si pgvector no está disponible', async () => {
      repo.hasVectorColumn.mockResolvedValue(false);
      expect(
        await store.writeVectors(
          'doc-1',
          [{ chunkIndex: 0, vector: vec() }],
          'm',
        ),
      ).toBe(false);
      expect(repo.writeVectors).not.toHaveBeenCalled();
    });

    it('ignora vectores con otra dimensión (no caben en la columna)', async () => {
      repo.hasVectorColumn.mockResolvedValue(true);
      expect(
        await store.writeVectors(
          'doc-1',
          [{ chunkIndex: 0, vector: [1, 2, 3] }],
          'm',
        ),
      ).toBe(false);
      expect(repo.writeVectors).not.toHaveBeenCalled();
    });

    it('guarda un literal por fragmento con el modelo indicado', async () => {
      repo.hasVectorColumn.mockResolvedValue(true);
      const ok = await store.writeVectors(
        'doc-1',
        [
          { chunkIndex: 0, vector: vec() },
          { chunkIndex: 1, vector: vec() },
        ],
        'bge-m3',
      );
      expect(ok).toBe(true);
      expect(repo.writeVectors).toHaveBeenCalledWith(
        'doc-1',
        [
          { chunkIndex: 0, literal: toVectorLiteral(vec()) },
          { chunkIndex: 1, literal: toVectorLiteral(vec()) },
        ],
        'bge-m3',
      );
    });

    it('si la escritura falla devuelve false (el indexador usa el respaldo Json) y re-verifica la disponibilidad', async () => {
      repo.hasVectorColumn.mockResolvedValue(true);
      repo.writeVectors.mockRejectedValue(
        new Error('different vector dimensions'),
      );
      expect(
        await store.writeVectors(
          'doc-1',
          [{ chunkIndex: 0, vector: vec() }],
          'm',
        ),
      ).toBe(false);
      await store.isAvailable(); // la caché se invalidó: vuelve a consultar
      expect(repo.hasVectorColumn).toHaveBeenCalledTimes(2);
    });
  });

  describe('search', () => {
    it('delega la búsqueda con el vector como literal y devuelve las filas', async () => {
      const rows = [
        {
          chunkId: 'c1',
          documentId: 'd1',
          documentTitle: 'T',
          content: 'C',
          score: 0.87,
        },
      ];
      repo.searchByVector.mockResolvedValue(rows);
      await expect(store.search('kb-1', vec(), 3, 'org-1')).resolves.toEqual(
        rows,
      );
      expect(repo.searchByVector).toHaveBeenCalledWith(
        'kb-1',
        toVectorLiteral(vec()),
        3,
        'org-1',
      );
    });
  });
});
