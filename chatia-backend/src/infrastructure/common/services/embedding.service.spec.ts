import { EmbeddingService } from '@/infrastructure/common/services/embedding.service.js';
import {
  AllProvidersFailedError,
  ProviderChainService,
} from '@/infrastructure/providers/provider-chain.service.js';
import { CircuitBreakerService } from '@/infrastructure/common/services/circuit-breaker.service.js';

describe('EmbeddingService', () => {
  let breaker: CircuitBreakerService;
  let svc: EmbeddingService;
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    breaker = new CircuitBreakerService();
    svc = new EmbeddingService(new ProviderChainService(breaker));
    process.env['SILICONFLOW_API_KEY'] = 'sf_test';
    delete process.env['EMBEDDINGS_PROVIDER'];
    delete process.env['EMBEDDINGS_MODEL'];
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    breaker.onModuleDestroy();
    delete process.env['SILICONFLOW_API_KEY'];
  });

  it('pide embeddings reales al endpoint /embeddings y normaliza el vector', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ embedding: [3, 4] }] }), {
        status: 200,
      }),
    );
    const v = await svc.embed('hola');
    expect(v).toEqual([0.6, 0.8]);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(
      /siliconflow.*\/embeddings$/,
    );
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]![1] as RequestInit).body),
    ) as { model: string; input: string[] };
    expect(body).toMatchObject({ model: 'BAAI/bge-m3', input: ['hola'] });
  });

  it('NUNCA devuelve un vector de ceros: si falla, lanza (antes devolvía ceros en silencio)', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('down', { status: 500 })),
    );
    await expect(svc.embed('hola')).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
  });

  it('sin API key lanza en vez de inventar un vector', async () => {
    delete process.env['SILICONFLOW_API_KEY'];
    await expect(svc.embed('hola')).rejects.toBeInstanceOf(
      AllProvidersFailedError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('el modelo se configura por env y se expone para registrarlo en cada fila', () => {
    expect(svc.modelName).toBe('BAAI/bge-m3');
    process.env['EMBEDDINGS_MODEL'] = 'otro/modelo';
    expect(svc.modelName).toBe('otro/modelo');
    delete process.env['EMBEDDINGS_MODEL'];
  });

  it('recorta textos larguísimos antes de enviarlos', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ embedding: [1] }] }), {
        status: 200,
      }),
    );
    await svc.embed('x'.repeat(10_000));
    const body = JSON.parse(
      String((fetchMock.mock.calls[0]![1] as RequestInit).body),
    ) as { input: string[] };
    expect(body.input[0]!.length).toBe(4000);
  });

  describe('embedMany (indexación)', () => {
    const rows = (n: number, offset = 0) => ({
      data: Array.from({ length: n }, (_, i) => ({
        index: i,
        embedding: [offset + i + 1, 0],
      })),
    });

    it('manda los textos en lotes de 32 y conserva el orden', async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify(rows(32)), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(rows(3, 100)), { status: 200 }),
        );
      const out = await svc.embedMany(
        Array.from({ length: 35 }, (_, i) => `t${i}`),
      );
      expect(out).toHaveLength(35);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const sent = fetchMock.mock.calls.map(
        (c) =>
          (
            JSON.parse(String((c[1] as RequestInit).body)) as {
              input: string[];
            }
          ).input.length,
      );
      expect(sent).toEqual([32, 3]);
    });

    it('reordena por "index" aunque el proveedor responda desordenado', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { index: 1, embedding: [0, 2] },
              { index: 0, embedding: [1, 0] },
            ],
          }),
          { status: 200 },
        ),
      );
      const out = await svc.embedMany(['a', 'b']);
      expect(out[0]![0]).toBeGreaterThan(out[0]![1]!); // [1,0] normalizado
      expect(out[1]![1]).toBeGreaterThan(out[1]![0]!); // [0,2] normalizado
    });

    it('respuesta incompleta (menos vectores que textos) cuenta como fallo, no se rellena', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify(rows(1)), { status: 200 })),
      );
      await expect(svc.embedMany(['a', 'b'])).rejects.toBeInstanceOf(
        AllProvidersFailedError,
      );
    });

    it('lista vacía → sin llamadas', async () => {
      await expect(svc.embedMany([])).resolves.toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('cosineSimilarity: idénticos=1, ortogonales=0, dimensiones distintas=0', () => {
    expect(svc.cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(svc.cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(svc.cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(svc.cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});
