// Camino Redis de RateLimitService (el de memoria está en rate-limit.service.spec.ts).
// ioredis se reemplaza por un doble: acá se prueba la LÓGICA (ventana, autocuración, degradación), no la red.
// El contra Redis real está en integration/queues-redis (mismo Redis de pruebas).
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

describe('RateLimitService con Redis', () => {
  const saved = {
    enabled: process.env['REDIS_ENABLED'],
    url: process.env['REDIS_URL'],
  };
  let svc: RateLimitService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['REDIS_ENABLED'] = 'true';
    process.env['REDIS_URL'] = 'redis://rl-test:6379';
    redisMock.incr.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    redisMock.ttl.mockResolvedValue(60);
    svc = new RateLimitService();
  });
  afterEach(() => {
    svc.onModuleDestroy();
    for (const [k, v] of [
      ['REDIS_ENABLED', saved.enabled],
      ['REDIS_URL', saved.url],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('conecta con fallo rápido (sin cola offline) y usa REDIS_URL', () => {
    expect(RedisCtor).toHaveBeenCalledWith('redis://rl-test:6379', {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 2_000,
    });
  });

  it('sin REDIS_URL cae a localhost', () => {
    delete process.env['REDIS_URL'];
    RedisCtor.mockClear();
    new RateLimitService().onModuleDestroy();
    expect(RedisCtor.mock.calls[0]?.[0]).toBe('redis://localhost:6379');
  });

  it('con REDIS_ENABLED distinto de "true" no crea cliente Redis (solo memoria)', () => {
    process.env['REDIS_ENABLED'] = 'false';
    RedisCtor.mockClear();
    new RateLimitService().onModuleDestroy();
    expect(RedisCtor).not.toHaveBeenCalled();
  });

  it('un error de Redis se registra y no tira el proceso', () => {
    const handler = redisMock.on.mock.calls.find(
      (c) => c[0] === 'error',
    )?.[1] as ((e: Error) => void) | undefined;
    expect(handler).toBeDefined();
    expect(() => handler?.(new Error('ECONNRESET'))).not.toThrow();
  });

  it('primer hit: INCR a la clave con prefijo, fija la expiración de la ventana y permite', async () => {
    const r = await svc.hit('widget:chat:ip:1.2.3.4', 5, 60);
    expect(redisMock.incr).toHaveBeenCalledWith('rl:widget:chat:ip:1.2.3.4');
    expect(redisMock.expire).toHaveBeenCalledWith(
      'rl:widget:chat:ip:1.2.3.4',
      60,
    );
    expect(r).toEqual({ allowed: true, count: 1, limit: 5, retryAfterSec: 60 });
  });

  it('hits siguientes NO renuevan la expiración (ventana fija, no deslizante)', async () => {
    redisMock.incr.mockResolvedValue(3);
    redisMock.ttl.mockResolvedValue(42);
    const r = await svc.hit('k', 5, 60);
    expect(redisMock.expire).not.toHaveBeenCalled();
    expect(r).toMatchObject({ allowed: true, count: 3, retryAfterSec: 42 });
  });

  it('el límite es inclusivo: count == limit pasa, limit+1 se bloquea', async () => {
    redisMock.incr.mockResolvedValueOnce(5);
    expect((await svc.hit('k', 5, 60)).allowed).toBe(true);
    redisMock.incr.mockResolvedValueOnce(6);
    const blocked = await svc.hit('k', 5, 60);
    expect(blocked).toMatchObject({ allowed: false, count: 6, limit: 5 });
  });

  it('autocuración: una clave sin expiración (ttl -1) recibe EXPIRE y no queda bloqueada para siempre', async () => {
    redisMock.incr.mockResolvedValue(7);
    redisMock.ttl.mockResolvedValue(-1);
    const r = await svc.hit('k', 5, 120);
    expect(redisMock.expire).toHaveBeenCalledWith('rl:k', 120);
    expect(r.retryAfterSec).toBe(120);
  });

  it.each([0, -2])(
    'ttl %i: el Retry-After cae al tamaño de la ventana',
    async (ttl) => {
      redisMock.incr.mockResolvedValue(9);
      redisMock.ttl.mockResolvedValue(ttl);
      expect((await svc.hit('k', 5, 30)).retryAfterSec).toBe(30);
      expect(redisMock.expire).not.toHaveBeenCalled();
    },
  );

  it('si Redis falla degrada a memoria local y SIGUE limitando (nunca fail-open sin límite)', async () => {
    redisMock.incr.mockRejectedValue(new Error("Stream isn't writeable"));
    const results: RateLimitResult[] = [];
    for (let i = 0; i < 4; i++) results.push(await svc.hit('k', 3, 60));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3]?.count).toBe(4);
  });

  it('onModuleDestroy desconecta Redis y vacía la memoria', async () => {
    redisMock.incr.mockRejectedValue(new Error('caído'));
    await svc.hit('k', 1, 60);
    svc.onModuleDestroy();
    expect(redisMock.disconnect).toHaveBeenCalledTimes(1);
    // memoria vacía: el contador empieza de nuevo
    expect((await svc.hit('k', 1, 60)).count).toBe(1);
  });
});
