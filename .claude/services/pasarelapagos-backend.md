# pasarelapagos-backend — Servicio de Pagos

## Rol
Procesamiento de pagos (MercadoPago, Stripe, dLocal, Conekta, Pagarme, Fake),
reconciliación, webhooks de proveedores, gestión de tenants/API keys.

## Puertos
- HTTP público: 3001
- gRPC interno: 5002

## Arquitectura (reestructurada 2026-10-02)

```
src/
├── core/
│   ├── strategies/          ← ProjectStrategy pattern
│   ├── payments/            ← dominio de pagos (sin controller ni processor)
│   │   ├── domain/
│   │   ├── repository/      ← solo interface (IPaymentsRepository)
│   │   ├── payment-state.machine.ts
│   │   ├── payments.service.ts
│   │   └── reconciliation.service.ts
│   ├── routing/             ← reglas de negocio de enrutamiento (no infraestructura)
│   └── organization-config/
├── modules/                 ← ÚNICO lugar con controllers HTTP por ecosistema
│   ├── welver/
│   ├── manzana/
│   ├── mexus/
│   └── index.ts             ← PasarelaModulesModule
├── infrastructure/
│   ├── prisma/
│   │   └── repositories/    ← PrismaPaymentsRepository (implementación concreta)
│   ├── firebase/
│   ├── redis/
│   ├── providers/           ← adapters de plataformas de pago
│   │   ├── adapters/stripe/, mercadopago/, conekta/, dlocal/, pagarme/, fake/
│   │   ├── provider.interface.ts
│   │   ├── provider.registry.ts
│   │   └── circuit-breaker.service.ts
│   ├── audit/
│   ├── metrics/
│   └── common/
├── webhooks/                ← recibe confirmaciones de providers externos
├── tenants/                 ← gestión de API keys
├── auth/                    ← SSO Firebase
├── queue/                   ← dlq.processor.ts + reconcile.processor.ts
├── grpc/
├── health/
└── internal/
```

## Clasificación de carpetas

### 🔴 BLOQUEANTES — no modificar sin ADR

| Carpeta | Razón |
|---|---|
| `src/infrastructure/prisma/` | Infraestructura core |
| `src/infrastructure/firebase/` | Firebase Auth — no reimplementar |
| `src/infrastructure/audit/` | Auditoría de pagos — compliance |
| `src/infrastructure/providers/provider.interface.ts` | Interface de providers — cambiarla rompe todos los adapters |
| `src/core/routing/routing.service.ts` | Reglas de negocio de enrutamiento — cambiar requiere ADR |
| `src/infrastructure/providers/circuit-breaker.service.ts` | Resiliencia de providers |
| `src/grpc/` | Entry point gRPC — contrato con el exterior |

### 🟡 DINÁMICA CONTROLADA

| Carpeta | Regla |
|---|---|
| `src/infrastructure/providers/adapters/` | Nuevos providers siguen `provider.interface.ts`. Cada adapter en su propia carpeta. |
| `src/modules/` | Nuevos ecosistemas siguen el molde — sin tocar `app.module.ts`. |
