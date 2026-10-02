# workers-backend — Servicio de Workers

## Rol
Ejecución de jobs asíncronos BullMQ: campañas de mensajería,
indexación de vectores para RAG, exportación de analytics, DLQ monitoring.

## Puertos
- HTTP interno: 3004
- gRPC interno: 5005

## Arquitectura (reestructurada 2026-10-02)

```
src/
├── core/
│   ├── campaigns/       ← dominio de campañas (sin controller)
│   │   ├── domain/
│   │   ├── interfaces/  ← campaigns.repository.interface.ts
│   │   └── campaigns.service.ts
│   └── jobs/            ← trazabilidad de jobs (sin controller ni constants)
│       └── jobs.service.ts
├── queue/               ← processors BullMQ + constants
│   ├── processors/
│   │   ├── analytics-export.processor.ts
│   │   ├── campaign-email.processor.ts
│   │   ├── faq-ingest.processor.ts
│   │   └── vector-index.processor.ts
│   └── queue.constants.ts   ← nombres de queues (no en core/)
├── infrastructure/
│   ├── prisma/
│   ├── metrics/
│   ├── common/
│   │   ├── filters/
│   │   ├── middleware/
│   │   ├── pipes/
│   │   └── services/    ← chunking, embedding, circuit-breaker, job-id.helper
│   └── types/
├── campaigns/           ← entry point HTTP (controller + module + schemas)
├── jobs/                ← entry point HTTP (controller + module + schemas)
├── dlq/                 ← inspección y retry de jobs fallidos
├── grpc/
├── health/
└── internal/
```

## Nota: no tiene `modules/`

workers-backend no tiene ecosistemas cliente. Los endpoints son iguales
para todos — `campaigns/` y `jobs/` son entry points transversales, no módulos de ecosistema.

## Clasificación de carpetas

### 🔴 BLOQUEANTES

| Carpeta | Razón |
|---|---|
| `src/infrastructure/prisma/` | Infraestructura core |
| `src/grpc/` | Entry point gRPC |
| `src/health/` | Railway healthcheck |
| `src/dlq/` | Dead Letter Queue monitoring — no simplificar sin ADR |
| `src/queue/processors/` | Procesadores BullMQ — la interface de jobs es el contrato con los productores |
| `src/queue/queue.constants.ts` | Nombres de queues — cambiarlos rompe los productores |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---|---|
| `src/queue/processors/` | Nuevos processors siguen el mismo patrón. El payload del job es el contrato — debe ser compatible con el productor. |
