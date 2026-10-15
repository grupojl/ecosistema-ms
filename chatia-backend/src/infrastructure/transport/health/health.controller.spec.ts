import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from '@/infrastructure/transport/health/health.controller.js';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn() };
  const cb = { getAll: jest.fn() };
  const incoming = { getFailedCount: jest.fn() };
  const outgoing = { getFailedCount: jest.fn() };
  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env['REDIS_ENABLED'] = 'true';
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    cb.getAll.mockResolvedValue({
      'groq-llm': 'CLOSED',
      'cartesia-tts': 'OPEN',
    });
    incoming.getFailedCount.mockResolvedValue(3);
    outgoing.getFailedCount.mockResolvedValue(1);
    controller = new HealthController(
      prisma as never,
      cb as never,
      incoming as never,
      outgoing as never,
    );
  });

  afterEach(() => {
    delete process.env['REDIS_ENABLED'];
  });

  it('/live no depende de nada externo', () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db caída'));
    expect(controller.live().status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('/ready responde OK con DB y Redis sanos', async () => {
    await expect(controller.ready()).resolves.toEqual({
      status: 'ok',
      db: true,
      redis: true,
    });
  });

  it('/ready → 503 si Postgres no responde', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db caída'));
    await expect(controller.ready()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('/ready → 503 si Redis no responde (antes se reportaba sano aunque estuviera caído)', async () => {
    incoming.getFailedCount.mockRejectedValue(new Error('ECONNREFUSED'));
    const err = await controller.ready().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getResponse()).toMatchObject({
      db: true,
      redis: false,
    });
  });

  it('/ready → 503 si Redis se cuelga (timeout)', async () => {
    jest.useFakeTimers();
    incoming.getFailedCount.mockReturnValue(new Promise(() => undefined));
    const pending = controller.ready().catch((e: unknown) => e);
    await jest.advanceTimersByTimeAsync(2_500);
    expect(await pending).toBeInstanceOf(ServiceUnavailableException);
    jest.useRealTimers();
  });

  it('Redis deshabilitado por configuración no cuenta como falla', async () => {
    process.env['REDIS_ENABLED'] = 'false';
    await expect(controller.ready()).resolves.toMatchObject({
      status: 'ok',
      redis: 'disabled',
    });
    expect(incoming.getFailedCount).not.toHaveBeenCalled();
  });

  it('/health extendido: circuit breakers, profundidad de DLQ y estado', async () => {
    const h = await controller.check();
    expect(h).toMatchObject({ status: 'ok', db: true, redis: true });
    expect(h.circuitBreakers).toEqual([
      { key: 'groq-llm', status: 'CLOSED' },
      { key: 'cartesia-tts', status: 'OPEN' },
    ]);
    expect(h.dlqDepth).toEqual({
      'incoming-message-dlq': 3,
      'outgoing-message-dlq': 1,
    });
  });

  it('/health: down si falla la base, degraded si falla solo Redis, y siempre 200', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('x'));
    expect((await controller.check()).status).toBe('down');

    incoming.getFailedCount.mockRejectedValue(new Error('x'));
    const h = await controller.check();
    expect(h.status).toBe('degraded');
    expect(h.dlqDepth).toEqual({
      'incoming-message-dlq': 0,
      'outgoing-message-dlq': 0,
    });
  });
});
