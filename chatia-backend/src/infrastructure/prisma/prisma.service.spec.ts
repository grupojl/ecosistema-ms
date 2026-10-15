import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';

type PoolLike = {
  options: Record<string, unknown>;
  emit: (e: string, ...a: unknown[]) => boolean;
  end: () => Promise<void>;
};
const poolOf = (s: PrismaService): PoolLike =>
  (s as unknown as { pool: PoolLike }).pool;

describe('PrismaService', () => {
  const KEYS = [
    'DATABASE_URL',
    'DB_POOL_MAX',
    'DB_CONNECT_TIMEOUT_MS',
    'DB_IDLE_TIMEOUT_MS',
    'DB_STATEMENT_TIMEOUT_MS',
  ];
  const saved: Record<string, string | undefined> = {};
  const created: PrismaService[] = [];
  const make = (): PrismaService => {
    const s = new PrismaService();
    created.push(s);
    return s;
  };

  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    process.env['DATABASE_URL'] = 'postgresql://u:p@127.0.0.1:1/none';
  });
  afterEach(async () => {
    for (const s of created.splice(0)) {
      await poolOf(s)
        .end()
        .catch(() => undefined);
    }
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('el pool nace con límites explícitos (una DB lenta no deja requests colgados)', () => {
    expect(poolOf(make()).options).toMatchObject({
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      statement_timeout: 15_000,
    });
  });

  it('los límites se configuran por entorno', () => {
    process.env['DB_POOL_MAX'] = '25';
    process.env['DB_CONNECT_TIMEOUT_MS'] = '1000';
    process.env['DB_IDLE_TIMEOUT_MS'] = '2000';
    process.env['DB_STATEMENT_TIMEOUT_MS'] = '3000';
    expect(poolOf(make()).options).toMatchObject({
      max: 25,
      connectionTimeoutMillis: 1_000,
      idleTimeoutMillis: 2_000,
      statement_timeout: 3_000,
    });
  });

  it.each(['abc', '0', '-5', ''])(
    'un valor inválido (%p) cae al valor por defecto, no rompe el pool',
    (bad) => {
      process.env['DB_POOL_MAX'] = bad;
      process.env['DB_STATEMENT_TIMEOUT_MS'] = bad;
      expect(poolOf(make()).options).toMatchObject({
        max: 10,
        statement_timeout: 15_000,
      });
    },
  );

  it('un error de un cliente inactivo del pool se registra y NO tira el proceso', () => {
    const s = make();
    const logged = jest
      .spyOn(
        (s as unknown as { logger: { error: () => void } }).logger,
        'error',
      )
      .mockImplementation(() => undefined);
    expect(() =>
      poolOf(s).emit('error', new Error('conexión reseteada')),
    ).not.toThrow();
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('conexión reseteada'),
    );
  });

  it('onModuleInit conecta; onModuleDestroy desconecta y cierra el pool aunque el cierre falle', async () => {
    const s = make();
    const connect = jest.spyOn(s, '$connect').mockResolvedValue(undefined);
    const disconnect = jest
      .spyOn(s, '$disconnect')
      .mockResolvedValue(undefined);
    const end = jest
      .spyOn(poolOf(s), 'end')
      .mockRejectedValue(new Error('ya cerrado'));

    await s.onModuleInit();
    expect(connect).toHaveBeenCalledTimes(1);

    await expect(s.onModuleDestroy()).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });
});
