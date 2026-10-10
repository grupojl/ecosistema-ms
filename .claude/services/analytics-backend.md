# analytics-backend — Servicio de Analíticas

## Rol
Persistencia de eventos de analítica, proyecciones agregadas,
SSE (Server-Sent Events) para dashboards en tiempo real, exportación.

## Puertos
- HTTP interno/público: 3012
- gRPC interno: 5012

## Arquitectura (reestructurada 2026-10-02)

```
src/
├── core/
│   ├── overview/        ← getOverview(), getConversationsByDay()
│   ├── agents/          ← getAgentMetrics()
│   ├── events/          ← persistEvent() + events.processor.ts
│   ├── projections/     ← proyecciones diarias
│   ├── export/          ← exportación async
│   └── analytics.constants.ts
├── modules/             ← ÚNICO lugar con controllers HTTP por ecosistema
│   ├── welver/
│   ├── manzana/
│   ├── mexus/
│   └── index.ts         ← AnalyticsModulesModule
├── sse/                 ← streaming SSE — igual para todos los ecosistemas
├── grpc/
├── health/
├── prisma/
└── common/
```

## Clasificación de carpetas

### 🔴 BLOQUEANTES

| Carpeta | Razón |
|---|---|
| `src/prisma/` | Infraestructura core |
| `src/grpc/` | Entry point gRPC — contrato con el exterior |
| `src/health/` | Railway healthcheck |
| `src/sse/` | SSE es la interfaz de tiempo real — no cambiar el endpoint sin coordinar consumers |
| `src/core/events/events.processor.ts` | Procesador de eventos — cambiar afecta toda la analítica |

### 🟢 DINÁMICAS

| Carpeta | Estado |
|---|---|
| `src/core/overview/` | Un service por responsabilidad — extensible |
| `src/core/agents/` | getAgentMetrics con GROUP BY en DB (DT-023 resuelto) |
| `src/modules/{eco}/` | Cada ecosistema expone sus propios endpoints de analytics |

## Nota sobre Domain en analytics
Las "entidades" de analytics son eventos inmutables + proyecciones (value objects).
El patrón Domain/Repository aplica de forma más ligera que en chatia/pagos.
