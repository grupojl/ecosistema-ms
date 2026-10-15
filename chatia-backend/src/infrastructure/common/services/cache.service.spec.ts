import { CacheService } from '@/infrastructure/common/services/cache.service.js';

const handlers: Record<string, (...args: unknown[]) => void> = {};
const redisMock = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  del: jest.fn(),
  on: jest.fn((event: string, fn: (...args: unknown[]) => void) => {
    handlers[event] = fn;
  }),
};

jest.mock('ioredis', () => ({ Redis: jest.fn(() => redisMock) }));

describe('CacheService', () => {
  let svc: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env['REDIS_ENABLED'] = 'true';
    redisMock.connect.mockResolvedValue(undefined);
    svc = new CacheService();
    await svc.onModuleInit();
  });

  afterEach(() => {
    delete process.env['REDIS_ENABLED'];
  });

  it('con Redis deshabilitado es un no-op y no conecta', async () => {
    process.env['REDIS_ENABLED'] = 'false';
    const off = new CacheService();
    await off.onModuleInit();
    await off.set('k', 1);
    expect(await off.get('k')).toBeNull();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('get devuelve el JSON parseado y null si no existe o está corrupto', async () => {
    redisMock.get.mockResolvedValueOnce('{"a":1}');
    expect(await svc.get('k')).toEqual({ a: 1 });
    redisMock.get.mockResolvedValueOnce(null);
    expect(await svc.get('k')).toBeNull();
    redisMock.get.mockResolvedValueOnce('{corrupto');
    expect(await svc.get('k')).toBeNull();
  });

  it('get nunca lanza: si Redis falla devuelve null', async () => {
    redisMock.get.mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(await svc.get('k')).toBeNull();
  });

  it('tryLock usa SET NX EX: true para el primero, false para el segundo', async () => {
    redisMock.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    expect(await svc.tryLock('job', 60)).toBe(true);
    expect(await svc.tryLock('job', 60)).toBe(false);
    expect(redisMock.set).toHaveBeenCalledWith('lock:job', '1', 'EX', 60, 'NX');
  });

  it('tryLock sin Redis o con Redis caído deja correr la tarea', async () => {
    process.env['REDIS_ENABLED'] = 'false';
    const off = new CacheService();
    await off.onModuleInit();
    expect(await off.tryLock('job', 60)).toBe(true);
    redisMock.set.mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(await svc.tryLock('job', 60)).toBe(true);
  });

  it('set guarda JSON con TTL', async () => {
    await svc.set('k', { x: 1 }, 60);
    expect(redisMock.set).toHaveBeenCalledWith('k', '{"x":1}', 'EX', 60);
  });

  it('del usa SCAN (no KEYS) y recorre todas las páginas', async () => {
    redisMock.scan
      .mockResolvedValueOnce(['17', ['orgcfg:a', 'orgcfg:b']])
      .mockResolvedValueOnce(['0', ['orgcfg:c']]);
    await svc.del('orgcfg:*');
    expect(redisMock.scan).toHaveBeenCalledTimes(2);
    expect(redisMock.del).toHaveBeenNthCalledWith(1, 'orgcfg:a', 'orgcfg:b');
    expect(redisMock.del).toHaveBeenNthCalledWith(2, 'orgcfg:c');
  });

  it('si la conexión inicial falla queda en modo no-op sin tirar la app', async () => {
    redisMock.connect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const broken = new CacheService();
    await expect(broken.onModuleInit()).resolves.toBeUndefined();
    expect(await broken.get('k')).toBeNull();
  });

  it('buildFaqKey es estable y depende de la KB y la pregunta', () => {
    expect(svc.buildFaqKey('kb1', 'hola')).toBe(svc.buildFaqKey('kb1', 'hola'));
    expect(svc.buildFaqKey('kb1', 'hola')).not.toBe(
      svc.buildFaqKey('kb2', 'hola'),
    );
  });
});
