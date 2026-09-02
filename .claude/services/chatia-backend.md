# chatia-backend — Servicio de Chat IA

## Rol
Chat IA, Knowledge Base (RAG + FAQ), Canales de comunicación, Agentes IA,
Proyectos, Contactos, Conversaciones, Mensajes.

## Puertos
- HTTP público: 3000
- gRPC interno: 5001

## Clasificación de carpetas

### 🔴 BLOQUEANTES — no modificar sin ADR

| Carpeta | Razón |
|---------|-------|
| `src/prisma/` | Infraestructura core — un solo PrismaModule, no duplicar |
| `src/common/` | Servicios compartidos (CacheService, CircuitBreakerService, EmbeddingService) — cambiar la interface rompe todos los módulos que la usan |
| `src/firebase/` | Firebase Auth — reimplementar aquí es bypass de `@ecosistema-ms/auth-server` |
| `src/queue/` | BullMQ queues + processors — la arquitectura de jobs está aquí |
| `src/events/` | EventEmitter global — cambiar la forma de emitir eventos afecta todos los módulos |
| `src/health/` | Railway healthcheck — no modificar el endpoint `/health` |
| `src/core/strategies/` | Patrón Strategy de ecosistemas — la interface `ProjectStrategy` es el contrato que todos los módulos de ecosistema implementan |
| `src/channels/channel.interface.ts` | Interface de canales — cambiarla rompe todos los adapters de canal |
| `src/grpc/` | Entry point gRPC — contrato con el exterior |
| `src/app.module.ts` | Raíz del módulo — no agregar lógica de negocio aquí |

### 🟡 DINÁMICA CONTROLADA — crecer siguiendo el molde

| Carpeta | Regla |
|---------|-------|
| `src/channels/` (implementaciones) | Nuevos canales siguen `channel.interface.ts`. No se modifica la interface sin ADR. |
| `src/modules/` (manzana/mexus/welver) | Nuevos ecosistemas siguen el mismo molde (enrich-context). La interface `ProjectStrategy` es BLOQUEANTE. |
| `src/faq/` (subcarpetas de documento/ingestion/rag) | La arquitectura de RAG es el molde. Nuevas funciones de FAQ siguen la misma estructura. |

### 🟢 DINÁMICAS — crecen libremente siguiendo el patrón Domain/Repository

| Carpeta | Estado actual | Molde a seguir |
|---------|---------------|----------------|
| `src/conversations/` | Service → Prisma directo | **MOLDE VIVO** — migrar primero |
| `src/contacts/` | Service → Prisma directo | conversations/ (post-migración) |
| `src/messages/` | Service → Prisma directo | conversations/ (post-migración) |
| `src/projects/` | Service → Prisma directo | conversations/ (post-migración) |
| `src/agents/` | Service → Prisma directo | conversations/ (post-migración) |
| `src/webhooks/` | Service → Prisma directo | conversations/ (post-migración) |
| `src/assistant/` | Lógica compleja de chat IA | conversations/ (post-migración) |
| `src/analytics/` | Proxy a analytics-backend | Mantener como proxy — no agregar lógica |

## Molde vivo de referencia

`src/conversations/` — será el molde una vez migrado a Domain + Repository.
Ver `modules/chatia-backend/conversations.md`.
