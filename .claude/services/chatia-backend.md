# chatia-backend — Servicio de Chat IA

## Rol
Chat IA, Knowledge Base (RAG + FAQ), Canales de comunicación, Agentes IA,
Proyectos, Contactos, Conversaciones, Mensajes.

## Puertos
- HTTP público: 3010
- gRPC interno: 5010

## Arquitectura (`src/` solo core / infrastructure / modules — ADR-022, 2026-10-15)

```
src/
├── core/                    ← dominio, sin controllers
│   ├── strategies/ conversations/ contacts/ messages/ agents/ projects/ assistant/ faq/
│   ├── assignment/ analytics-events/ ai-config/ notifications/ ecosystem/ organizations/ organization-config/
│   ├── webhooks/ widget/ channel-accounts/ agent-notifications/   ← lógica de los entry points
│   └── privacy/             ← retención y derecho de supresión
├── modules/                 ← ÚNICO lugar con controllers HTTP de negocio
│   ├── common/              ← API común a todos los ecosistemas (/api/v1/...) — 14 controllers, CommonApiModule
│   ├── welver/ manzana/ mexus/   ← strategy + config + endpoints EXCLUSIVOS (/api/<eco>/v1/...)
│   └── index.ts             ← ChatiaModulesModule
├── infrastructure/
│   ├── prisma/ firebase/ groq/ providers/ langgraph/ security/ common/ config/ types/
│   ├── channels/            ← WhatsApp, Instagram, Messenger, TikTok + adapters multimodales
│   ├── events/              ← WebSocket gateway
│   ├── queue/               ← processors BullMQ (incoming, outgoing, auto-reply, ...) + DLQ
│   ├── transport/           ← grpc/, health/, internal/
│   ├── maintenance/         ← CLI (pnpm encrypt:tokens)
│   └── testing/             ← fixtures, stubs, integración y architecture.spec.ts
├── generated/               ← cliente Prisma (salida de herramienta)
├── main.ts
└── app.module.ts            ← importa ChatiaModulesModule
```

## Clasificación de carpetas

### 🔴 BLOQUEANTES — no modificar sin ADR

| Carpeta | Razón |
|---|---|
| `src/infrastructure/prisma/` | Infraestructura core — un solo PrismaModule |
| `src/infrastructure/firebase/` | Firebase Auth — no reimplementar |
| `src/infrastructure/common/` | Guards, pipes, decorators compartidos |
| `src/core/strategies/` | Interface ProjectStrategy — contrato con todos los módulos de ecosistema |
| `src/infrastructure/channels/channel.interface.ts` | Interface de canales — cambiarla rompe todos los adapters |
| `src/infrastructure/transport/grpc/` | Entry point gRPC — contrato con el exterior |
| `src/infrastructure/queue/` | BullMQ queues + processors |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---|---|
| `src/infrastructure/channels/` (implementaciones) | Nuevos canales siguen `channel.interface.ts`. No modificar la interface sin ADR. |
| `src/modules/` | Nuevos ecosistemas siguen el molde. `ProjectStrategy` es BLOQUEANTE. |
| `src/infrastructure/providers/` | Nuevos adapters siguen el patrón de inyección por token. |

### 🟢 DINÁMICAS

| Carpeta | Estado |
|---|---|
| `src/core/conversations/` | Domain/Repository implementado — MOLDE VIVO |
| `src/core/contacts/` | Domain/Repository implementado |
| `src/core/faq/` | RAG funcionando — extensible |
