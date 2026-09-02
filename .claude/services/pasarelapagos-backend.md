# pasarelapagos-backend — Servicio de Pagos

## Rol
Procesamiento de pagos (MercadoPago, Stripe, dLocal, Conekta, Pagarme, Fake),
reconciliación, webhooks de proveedores, gestión de tenants/API keys.

## Puertos
- HTTP público: 3001
- gRPC interno: 5002

## Clasificación de carpetas

### 🔴 BLOQUEANTES — no modificar sin ADR

| Carpeta | Razón |
|---------|-------|
| `src/prisma/` | Infraestructura core |
| `src/common/` | PII service, shared guards — seguridad y privacidad de datos |
| `src/modules/firebase/` | Firebase Auth — no reimplementar |
| `src/modules/audit/` | Auditoría de pagos — obligatoria por compliance, no se omite |
| `src/modules/metrics/` | Prometheus — observabilidad |
| `src/modules/redis/` | Cache de infraestructura |
| `src/modules/queue/` | BullMQ — jobs de reconciliación y webhooks |
| `src/modules/providers/provider.interface.ts` | Interface de providers — cambiarla rompe todos los adapters |
| `src/modules/providers/routing.service.ts` | Lógica de routing entre providers — cambiar la estrategia requiere ADR |
| `src/modules/providers/circuit-breaker.service.ts` | Resiliencia de providers — no duplicar por provider |
| `src/pagos/` | Entry point gRPC — contrato con el exterior |
| `src/app.module.ts` | Raíz — no agregar lógica aquí |

### 🟡 DINÁMICA CONTROLADA — crecer siguiendo el molde

| Carpeta | Regla |
|---------|-------|
| `src/modules/providers/adapters/` | Nuevos providers siguen `provider.interface.ts`. No se modifica la interface sin ADR. Cada adapter vive en su propia carpeta. |

### 🟢 DINÁMICAS — crecen libremente siguiendo Domain/Repository

| Carpeta | Estado actual | Molde a seguir |
|---------|---------------|----------------|
| `src/modules/payments/` | Service → Prisma directo | **MOLDE VIVO** de pagos — migrar primero |
| `src/modules/webhooks/` | Service → Prisma directo | payments/ (post-migración) |
| `src/modules/tenants/` | Service → Prisma directo | payments/ (post-migración) |

## Molde vivo de referencia

`src/modules/payments/` — será el molde una vez migrado a Domain + Repository.
Los estados de pago y sus transiciones son las invariantes de dominio clave.
