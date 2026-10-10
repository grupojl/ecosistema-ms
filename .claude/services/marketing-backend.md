# marketing-backend — Servicio de Marketing

## Rol
Sincronización de métricas de campañas (Meta, Google, TikTok),
automatización de reglas sobre métricas, atribución de conversiones de pagos.

## Puertos
- HTTP público: 3015
- gRPC interno: 5015

## Arquitectura (reestructurada 2026-10-02)

```
src/
├── core/
│   ├── campaigns/
│   │   ├── domain/
│   │   │   ├── campaign.entity.ts
│   │   │   ├── automation-rule.entity.ts
│   │   │   └── campaign.errors.ts
│   │   ├── interfaces/
│   │   │   └── campaigns.repository.interface.ts  ← solo interface
│   │   └── campaigns.service.ts
│   ├── attribution/     ← lógica de atribución de conversiones
│   └── ad-accounts/
│       ├── interfaces/
│       │   ├── ad-platform.interface.ts    ← IAdPlatform
│       │   ├── ad-accounts.repository.interface.ts
│       │   └── ad-platform.tokens.ts       ← META_ADS_TOKEN, GOOGLE_ADS_TOKEN, TIKTOK_ADS_TOKEN
│       └── ad-accounts.service.ts
├── modules/             ← ÚNICO lugar con controllers HTTP por ecosistema
│   ├── welver/
│   ├── manzana/
│   ├── mexus/
│   └── index.ts         ← MarketingModulesModule
├── infrastructure/
│   ├── persistence/     ← PrismaService + repositorios concretos (Prisma*)
│   ├── adapters/        ← adapters de plataformas de publicidad
│   │   ├── meta/
│   │   ├── google/
│   │   └── tiktok/
│   ├── adapters.module.ts   ← bindings DI: META_ADS_TOKEN → MetaAdsAdapter
│   ├── metrics/
│   ├── contracts/
│   │   └── pasarela-pagos.contract.ts  ← contrato de eventos de conversión
│   ├── common/
│   └── types/
├── queue/
│   ├── processors/
│   │   ├── automation-check.processor.ts
│   │   ├── sync-metrics.processor.ts
│   │   └── attribute-conversion.processor.ts
│   └── queue.constants.ts
├── ad-accounts/         ← entry point transversal (OAuth, conexión, revocación)
├── grpc/
├── health/
└── internal/
```

## Principio de inversión de dependencias

El core define `IAdPlatform` + tokens (`META_ADS_TOKEN`, etc.).
`infrastructure/adapters/meta/`, `google/`, `tiktok/` implementan.
El core **nunca importa** los adapters concretos — solo los tokens.

## Clasificación de carpetas

### 🔴 BLOQUEANTES

| Carpeta | Razón |
|---|---|
| `src/infrastructure/persistence/` | Prisma — infraestructura core |
| `src/core/ad-accounts/interfaces/ad-platform.interface.ts` | Interface de plataformas — cambiarla rompe los 3 adapters |
| `src/core/ad-accounts/interfaces/ad-platform.tokens.ts` | Tokens DI — cambiarlos rompe el wiring |
| `src/infrastructure/contracts/pasarela-pagos.contract.ts` | Contrato inter-servicio con pasarelapagos |
| `src/grpc/` | Entry point gRPC |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---|---|
| `src/infrastructure/adapters/` | Nuevas plataformas implementan `IAdPlatform` y se proveen via su token. Cada adapter en su propia carpeta. |
| `src/modules/` | Nuevos ecosistemas siguen el molde — sin tocar `app.module.ts`. |
