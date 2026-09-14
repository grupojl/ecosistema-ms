# ADR-009 — Hacia 9.5/10: código producción-ready

**Estado:** Aceptado — Implementado — 2026-09-12T19:29:30Z
**Fecha:** 2025-Q3
**Puntaje antes:** 8.0 / 10 (sin tests/obs/deploy)
**Puntaje objetivo:** 9.5 / 10

---

## Contexto

Con ADR-008 se resolvió infraestructura base (logger, metrics, middleware, CI/CD estructura).
Quedan cuatro brechas que impiden superar el 8.5:

| ID | Brecha | Dimensión impactada |
|----|--------|---------------------|
| DT-023 | `getAgentMetrics` carga 100K rows en Node.js | Base de datos: 6.5 → 9.0 |
| DT-027 | `main.ts` sin `ZodExceptionFilter` (ZodError sale como 500) | Calidad código: 7.5 → 9.0 |
| DT-028 | packages/logger + metrics existen pero no se importan en app.module | Config: 9.0 → 9.5 |
| DT-029 | ConversationsService usa `this.prisma` directamente pese a IRepository | Arquitectura: 8.5 → 9.0 |

## Decisiones

### D1 — DT-023: getAgentMetrics → $queryRaw GROUP BY PostgreSQL
Reemplaza `findMany(take: 50_000)` × 2 por tres `$queryRaw` paralelos con
GROUP BY. La paginación ocurre en SQL (LIMIT/OFFSET). Sin carga de filas en Node.
Índices compuestos sobre `(organizationId, ecosystemId, eventType, occurredAt)`.

**Por qué $queryRaw y no Prisma groupBy:**
`groupBy` no soporta acceso a campos JSON anidados (`payload->>'agentId'`).

### D2 — DT-027: ZodExceptionFilter global — orden correcto en main.ts
Se crea `packages/auth-server/src/filters/zod-exception.filter.ts`.
En cada `main.ts`: `useGlobalFilters(new ZodExceptionFilter())` ANTES de `useGlobalPipes`.
Sin este orden los ZodError salen como HTTP 500.

### D3 — DT-028: LoggerModule + PrometheusModule en app.module.ts
Cada `app.module.ts` importa pino y prometheus.
`RequestIdMiddleware` se registra via `configure()` del NestModule.

### D4 — DT-029: ConversationsService sin PrismaService directo
El acceso `this.prisma` en `handleIncomingMessage` se elimina.
Todo el acceso a DB va por `IConversationsRepository`. Cierra ADR-002.

## Proyección de puntaje (sin tests/obs/deploy)

| Dimensión            | v8.0 | v9.5 |
|----------------------|------|------|
| Arquitectura/Capas   | 8.5  | 9.0  |
| Contratos/Tipado     | 8.0  | 8.5  |
| Multi-tenancy        | 9.0  | 9.0  |
| Comunicación gRPC    | 7.5  | 7.5  |
| Calidad de código    | 7.5  | 9.0  |
| Base de datos        | 6.5  | 9.0  |
| Seguridad/RBAC       | 7.0  | 7.5  |
| Config/Twelve-Factor | 9.0  | 9.5  |
| Documentación .claude| 9.5  | 9.5  |
| **Promedio**         | **8.0** | **9.1** |

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Prisma `groupBy` para agentMetrics | No soporta payload JSON — $queryRaw obligatorio |
| Mantener ValidationPipe sin ZodFilter | ZodError → HTTP 500 en producción |
| Herencia de AppModule base | NestJS no tiene herencia limpia de módulos |
