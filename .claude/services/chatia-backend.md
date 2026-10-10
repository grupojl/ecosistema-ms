# chatia-backend — Servicio de Chat IA

## Rol
Chat IA, Knowledge Base (RAG + FAQ), Canales de comunicación, Agentes IA,
Proyectos, Contactos, Conversaciones, Mensajes.

## Puertos
- HTTP público: 3010
- gRPC interno: 5010

## Arquitectura (reestructurada 2026-10-02)

```
src/
├── core/                    ← 14 bounded contexts sin controllers
│   ├── strategies/          ← ProjectStrategy pattern
│   ├── conversations/
│   ├── contacts/
│   ├── messages/
│   ├── agents/
│   ├── projects/
│   ├── assistant/
│   ├── faq/
│   ├── assignment/
│   ├── analytics-events/
│   ├── ai-config/
│   ├── notifications/
│   ├── ecosystem/
│   ├── organizations/
│   ├── organization-config/
│   └── index.ts
├── modules/                 ← ÚNICO lugar con controllers HTTP por ecosistema
│   ├── welver/
│   ├── manzana/
│   ├── mexus/
│   └── index.ts             ← ChatiaModulesModule
├── infrastructure/
│   ├── prisma/
│   ├── firebase/
│   ├── groq/
│   ├── langgraph/
│   ├── common/              ← guards, decorators, pipes, filters, middleware
│   ├── config/
│   └── types/
├── webhooks/                ← entry point canales externos
├── widget/                  ← chat público embeddable
├── channel-accounts/        ← gestión de cuentas de canal
├── agent-notifications/     ← alertas in-app para agentes
├── channels/                ← adapters de canales (WhatsApp, Instagram, etc.)
├── queue/                   ← processors BullMQ
├── events/                  ← WebSocket gateway
├── health/
├── internal/
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
| `src/channels/channel.interface.ts` | Interface de canales — cambiarla rompe todos los adapters |
| `src/grpc/` | Entry point gRPC — contrato con el exterior |
| `src/queue/` | BullMQ queues + processors |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---|---|
| `src/channels/` (implementaciones) | Nuevos canales siguen `channel.interface.ts`. No modificar la interface sin ADR. |
| `src/modules/` | Nuevos ecosistemas siguen el molde. `ProjectStrategy` es BLOQUEANTE. |
| `src/infrastructure/adapters/` | Nuevos adapters siguen el patrón de inyección por token. |

### 🟢 DINÁMICAS

| Carpeta | Estado |
|---|---|
| `src/core/conversations/` | Domain/Repository implementado — MOLDE VIVO |
| `src/core/contacts/` | Domain/Repository implementado |
| `src/core/faq/` | RAG funcionando — extensible |
