# notificaciones-backend — Servicio de Notificaciones

## Rol
Envío de notificaciones multicanal (Email, Push, WhatsApp),
idempotencia, DLQ, preferencias de usuario, renderizado de templates.

## Puertos
- HTTP interno: 3002
- gRPC interno: 5003

## Arquitectura (reestructurada 2026-10-02)

```
src/
├── core/
│   ├── notifications/
│   │   ├── dedup/           ← idempotencia
│   │   ├── domain/
│   │   │   ├── notification.errors.ts
│   │   │   └── notification-template.types.ts  ← TemplateId enum + TemplateData
│   │   ├── interfaces/
│   │   │   ├── notification-channel.interface.ts  ← INotificationChannel
│   │   │   ├── channel-tokens.ts    ← NS_EMAIL_CHANNEL_TOKEN, NS_PUSH_CHANNEL_TOKEN, NS_WHATSAPP_CHANNEL_TOKEN
│   │   │   └── template-renderer.token.ts
│   │   └── repository/
│   ├── preferences/
│   └── strategies/
├── modules/                 ← ÚNICO lugar con controllers HTTP por ecosistema
│   ├── welver/
│   ├── manzana/
│   ├── mexus/
│   └── index.ts             ← NotificacionesModulesModule
├── infrastructure/
│   ├── prisma/
│   ├── channels/            ← email.adapter.ts, push.adapter.ts, whatsapp.adapter.ts
│   ├── templates/           ← HandlebarsRenderer + templates .hbs
│   ├── metrics/
│   ├── common/
│   │   └── services/
│   │       └── circuit-breaker.service.ts
│   ├── contracts/
│   │   └── chatia-internal.interface.ts
│   └── types/
├── queue/
│   ├── processors/
│   │   └── notification.processor.ts
│   └── dlq/
├── grpc/
└── health/
```

## Principio de inversión de dependencias

El core define tokens (`NS_EMAIL_CHANNEL_TOKEN`) e interfaces (`INotificationChannel`).
`infrastructure/channels/` implementa. El core **nunca importa** los adapters concretos.
La dirección de dependencia es siempre: `infrastructure → core`.

## Clasificación de carpetas

### 🔴 BLOQUEANTES

| Carpeta | Razón |
|---|---|
| `src/infrastructure/prisma/` | Infraestructura core |
| `src/grpc/` | Entry point gRPC — contrato con el exterior |
| `src/core/notifications/interfaces/channel-tokens.ts` | Tokens DI — cambiarlos rompe el wiring |
| `src/core/notifications/interfaces/notification-channel.interface.ts` | Interface de canales — cambiarla rompe los 3 adapters |
| `src/core/notifications/dedup/` | Idempotencia — no modificar sin entender el impacto |
| `src/queue/dlq/` | Dead Letter Queue — no simplificar sin ADR |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---|---|
| `src/infrastructure/channels/` | Nuevos canales implementan `INotificationChannel` e `NS_{CANAL}_CHANNEL_TOKEN`. No modificar la interface sin ADR. |
| `src/infrastructure/templates/` | Nuevos templates agregan archivo `.hbs` y el `TemplateId` enum. |
