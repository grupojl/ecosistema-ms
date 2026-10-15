import { RateLimitService } from '@/infrastructure/security/rate-limit.service.js';

describe('RateLimitService (memoria)', () => {
  let svc: RateLimitService;

  beforeEach(() => {
    delete process.env['REDIS_ENABLED'];
    svc = new RateLimitService();
  });

  afterEach(async () => {
    svc.onModuleDestroy();
    jest.useRealTimers();
  });

  it('permite hasta el límite y bloquea el siguiente con retryAfter', async () => {
    for (let i = 1; i <= 3; i++)
      expect((await svc.hit('k', 3, 60)).allowed).toBe(true);
    const blocked = await svc.hit('k', 3, 60);
    expect(blocked.allowed).toBe(false);
    expect(blocked.count).toBe(4);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('las claves son independientes', async () => {
    await svc.hit('a', 1, 60);
    expect((await svc.hit('a', 1, 60)).allowed).toBe(false);
    expect((await svc.hit('b', 1, 60)).allowed).toBe(true);
  });

  it('la ventana se reinicia al vencer', async () => {
    jest.useFakeTimers();
    await svc.hit('w', 1, 10);
    expect((await svc.hit('w', 1, 10)).allowed).toBe(false);
    jest.advanceTimersByTime(11_000);
    expect((await svc.hit('w', 1, 10)).allowed).toBe(true);
  });
});
