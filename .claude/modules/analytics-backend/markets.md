# Markets en analytics-backend

## Rol

`marketCountry` es una **dimensión de segmentación** en todos los eventos de analytics.
Permite responder: "¿cuántas ventas tuve en CO este mes?" sin joins complejos.

## Cambios en el schema de eventos

```prisma
model AnalyticsEvent {
  // ... campos existentes ...
  marketCountry  String?  @map("market_country")  // NUEVO — dimensión de análisis
}
```

## Proyecciones afectadas

Las proyecciones de `ProjectionsService` deben incluir `marketCountry`
como dimensión de agrupación cuando esté disponible:

```typescript
// projections.service.ts — agregar agrupación por market
async getRevenueByMarket(organizationId: string, from: Date, to: Date) {
  return this.prisma.analyticsEvent.groupBy({
    by: ['marketCountry'],
    where: { organizationId, eventType: 'ORDER_COMPLETED', createdAt: { gte: from, lte: to } },
    _sum: { amountCents: true },
  })
}
```

## Checklist

- [ ] MKT-AN-01: Migración Prisma — `marketCountry` en AnalyticsEvent
- [ ] MKT-AN-02: Extraer de payload o header en AnalyticsController
- [ ] MKT-AN-03: `getRevenueByMarket()` en ProjectionsService
- [ ] MKT-AN-04: Endpoint gRPC para que superadmin consulte revenue por Market
