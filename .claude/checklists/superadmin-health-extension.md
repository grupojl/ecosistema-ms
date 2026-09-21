# Checklist: /health extendido para superadmin — IMPLEMENTADO ✅

**Estado:** Aplicado en los 5 MS (sesión 2026-09-19)

## Shape canónico implementado

```ts
@Get()
async check(): Promise<ExtendedHealth> {
  const [dbOk, redisOk] = await Promise.allSettled([
    this.prisma.$queryRaw`SELECT 1`,
    this.redis.ping(),
  ]);

  const circuitBreakers = Object.entries(cbStates).map(([key, status]) => ({
    key,
    status: status as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
  }));

  const dlqDepth: Record<string, number> = {
    'queue-name-dlq': await queue.getFailedCount(),
  };

  return {
    status:   dbOk.status === 'fulfilled' ? 'ok' : 'degraded',
    db:       dbOk.status === 'fulfilled',
    redis:    redisOk.status === 'fulfilled',
    circuitBreakers,
    dlqDepth,
    uptime:   Math.floor(process.uptime()),
    version:  process.env['npm_package_version'] ?? '0.0.0',
  };
}
```

## Notas por MS

- **analytics-backend** y **workers-backend**: `circuitBreakers: []` — correcto,
  sus CBs son internos y no relevantes para el panel.
- **Sin auth en /health** — Railway healthcheck no envía token.
