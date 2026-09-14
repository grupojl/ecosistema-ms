# Parche DT-023 — getAgentMetrics: reemplazar in-memory aggregation por SQL

## Problema

`getAgentMetrics` en `analytics-backend/src/analytics/analytics.service.ts`
carga hasta 100K rows en memoria con dos `findMany(..., take: 50_000)` separados
y los agrega en Node.js. En producción con múltiples organizaciones esto es
una bomba de tiempo de memoria y latencia.

## Solución

Reemplazar los dos `findMany` por dos `groupBy` de Prisma que hacen la
agregación en PostgreSQL:

```typescript
// ANTES — dos findMany con take 50_000 (bug de escala)
const [assigned, resolved] = await Promise.all([
  this.prisma.analyticsEvent.findMany({
    where: { organizationId, ecosystemId, eventType: 'conversation.assigned', ... },
    select: { payload: true },
    take: 50_000,
  }),
  this.prisma.analyticsEvent.findMany({ ... take: 50_000 }),
]);
// ... agrupación en Node.js

// DESPUÉS — GROUP BY en PostgreSQL
const [assignedGroups, resolvedGroups] = await Promise.all([
  this.prisma.$queryRaw<Array<{ agent_id: string; count: bigint }>>`
    SELECT
      payload->>'agentId' AS agent_id,
      COUNT(*) AS count
    FROM "AnalyticsEvent"
    WHERE
      "organizationId" = ${organizationId}
      AND "ecosystemId"  = ${ecosystemId}
      AND "eventType"    = 'conversation.assigned'
      AND "occurredAt" BETWEEN ${from} AND ${to}
      AND payload->>'agentId' IS NOT NULL
    GROUP BY payload->>'agentId'
    ORDER BY count DESC
    LIMIT ${limit} OFFSET ${offset}
  `,
  this.prisma.$queryRaw<Array<{ agent_id: string; count: bigint }>>`
    SELECT
      payload->>'agentId' AS agent_id,
      COUNT(*) AS count
    FROM "AnalyticsEvent"
    WHERE
      "organizationId" = ${organizationId}
      AND "ecosystemId"  = ${ecosystemId}
      AND "eventType"    = 'conversation.resolved_by_agent'
      AND "occurredAt" BETWEEN ${from} AND ${to}
      AND payload->>'agentId' IS NOT NULL
    GROUP BY payload->>'agentId'
  `,
]);

const resolvedMap = new Map(resolvedGroups.map(r => [r.agent_id, Number(r.count)]));
const agents = assignedGroups.map(a => ({
  agentId:  a.agent_id,
  assigned: Number(a.count),
  resolved: resolvedMap.get(a.agent_id) ?? 0,
}));

const [{ count: total }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
  SELECT COUNT(DISTINCT payload->>'agentId') AS count
  FROM "AnalyticsEvent"
  WHERE "organizationId" = ${organizationId}
    AND "ecosystemId"    = ${ecosystemId}
    AND "eventType"      = 'conversation.assigned'
    AND "occurredAt" BETWEEN ${from} AND ${to}
`;

return { agents, total: Number(total) };
```

## Índice requerido en schema.prisma

```prisma
model AnalyticsEvent {
  // ... campos existentes
  @@index([organizationId, ecosystemId, eventType, occurredAt])
  @@index([organizationId, ecosystemId, occurredAt])
}
```

## Test requerido

```typescript
it('no carga rows en memoria para organización con 100K eventos', async () => {
  // Mock del prisma.$queryRaw para verificar que se llama con GROUP BY
  const queryRawSpy = jest.spyOn(prisma, '$queryRaw').mockResolvedValue([]);
  await service.getAgentMetrics({ organizationId: 'org1', ecosystemId: 'eco1', from, to });
  expect(queryRawSpy).toHaveBeenCalled();
  expect(prisma.analyticsEvent.findMany).not.toHaveBeenCalled();
});
```
