// Endurecimiento del rate limit en memoria: bordes de la ventana, Retry-After, barrido de entradas vencidas
// (evita que el mapa crezca sin límite ante un ataque con claves distintas) y trazas de degradación.
const redisMock = {
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};
const RedisCtor = jest.fn((_url?: string, _opts?: object) => redisMock);
jest.mock('ioredis', () => ({ Redis: RedisCtor }));

import {
  RateLimitService,
  type RateLimitResult,
} from '@/infrastructure/security/rate-limit.service.js';

const sizeOf = (s: RateLimitService): number =>
  (s as unknown as { memory: Map<string, unknown> }).memory.size;
const loggerOf = (s: RateLimitService) =>
  (s as unknown as { logger: { warn: (m: string) => void } }).logger;

describe('RateLimitService — memoria', () => {
  let svc: RateLimitService;
  const saved = process.env['REDIS_ENABLED'];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: 1_800_000_000_000 });
    delete process.env['REDIS_ENABLED'];
    svc = new RateLimitService();
  });
  afterEach(() => {
    svc.onModuleDestroy();
    jest.useRealTimers();
    if (saved === undefined) delete process.env['REDIS_ENABLED'];
    else process.env['REDIS_ENABLED'] = saved;
  });

  it('sin Redis no se crea cliente ni se registran avisos de degradación', async () => {
    const warn = jest
      .spyOn(loggerOf(svc), 'warn')
      .mockImplementation(() => undefined);
    await svc.hit('k', 5, 60);
    expect(RedisCtor).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('cuenta dentro de la ventana y bloquea al superar el límite (inclusivo)', async () => {
    const r: RateLimitResult[] = [];
    for (let i = 0; i < 4; i++) r.push(await svc.hit('k', 3, 60));
    expect(r.map((x) => x.allowed)).toEqual([true, true, true, false]);
    expect(r.map((x) => x.count)).toEqual([1, 2, 3, 4]);
    expect(r[0]).toMatchObject({ limit: 3 });
  });

  it('Retry-After es el tiempo restante real de la ventana (no 1)', async () => {
    expect((await svc.hit('k', 5, 30)).retryAfterSec).toBe(30);
    jest.advanceTimersByTime(10_000);
    expect((await svc.hit('k', 5, 30)).retryAfterSec).toBe(20);
  });

  it('Retry-After nunca baja de 1 segundo', async () => {
    await svc.hit('k', 5, 30);
    jest.advanceTimersByTime(29_900); // quedan 100 ms
    expect((await svc.hit('k', 5, 30)).retryAfterSec).toBe(1);
  });

  it('en el instante exacto del vencimiento la ventana se reinicia (<=, no <)', async () => {
    await svc.hit('k', 1, 10);
    expect((await svc.hit('k', 1, 10)).allowed).toBe(false);
    jest.advanceTimersByTime(10_000); // now == resetAt
    expect(await svc.hit('k', 1, 10)).toMatchObject({
      allowed: true,
      count: 1,
    });
  });

  it('claves distintas no se cuentan entre sí', async () => {
    await svc.hit('a', 1, 60);
    expect((await svc.hit('a', 1, 60)).allowed).toBe(false);
    expect((await svc.hit('b', 1, 60)).allowed).toBe(true);
  });

  describe('barrido de entradas vencidas', () => {
    const fill = async (n: number, window: number, prefix = 'x') => {
      for (let i = 0; i < n; i++) await svc.hit(`${prefix}${i}`, 1, window);
    };

    it('con exactamente 10.000 entradas NO barre; con más, sí, y solo borra las vencidas', async () => {
      await fill(10_000, 1); // 10.000 que vencerán
      jest.advanceTimersByTime(2_000);
      await svc.hit('vigente-1', 1, 3_600); // tamaño 10.000 → todavía no barre; ahora hay 10.001
      expect(sizeOf(svc)).toBe(10_001);

      await svc.hit('vigente-2', 1, 3_600); // tamaño 10.001 > 10.000 → barre las vencidas
      expect(sizeOf(svc)).toBe(2); // las 10.000 vencidas se fueron; quedan vigente-1 y vigente-2
    });

    it('el barrido conserva las entradas que siguen vigentes', async () => {
      await fill(5_000, 1, 'viejo');
      await fill(5_001, 3_600, 'vivo');
      jest.advanceTimersByTime(2_000);
      await svc.hit('nueva', 1, 60); // size 10.001 > 10.000 → barre
      // quedan las 5.001 vivas + la nueva; las 5.000 vencidas se fueron
      expect(sizeOf(svc)).toBe(5_002);
      // una vigente conserva su contador
      expect((await svc.hit('vivo0', 1, 3_600)).count).toBe(2);
    });
  });

  describe('degradación desde Redis', () => {
    beforeEach(() => {
      process.env['REDIS_ENABLED'] = 'true';
      svc.onModuleDestroy();
      svc = new RateLimitService();
    });

    it('el error de conexión de Redis se registra con su mensaje', () => {
      const warn = jest
        .spyOn(loggerOf(svc), 'warn')
        .mockImplementation(() => undefined);
      const handler = redisMock.on.mock.calls.find(
        (c) => c[0] === 'error',
      )?.[1] as (e: Error) => void;
      handler(new Error('ECONNREFUSED'));
      expect(warn).toHaveBeenCalledWith('Redis (rate limit): ECONNREFUSED');
    });

    it('si Redis falla en un hit se avisa y se sigue con memoria', async () => {
      redisMock.incr.mockRejectedValue(new Error('timeout'));
      const warn = jest
        .spyOn(loggerOf(svc), 'warn')
        .mockImplementation(() => undefined);
      const r = await svc.hit('k', 2, 60);
      expect(r).toMatchObject({ allowed: true, count: 1 });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain(
        'Rate limit con Redis falló, uso memoria local',
      );
      expect(warn.mock.calls[0]?.[0]).toContain('timeout');
    });
  });
});
