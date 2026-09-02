# Checklists 10/10 por capa — Estado actual

## Backend (5 microservicios)

| Capa | Archivo | Score | Tendencia | Bloqueante |
|---|---|---|---|---|
| 1 — Auth/Tenant | `backend-capa-1-auth.md` | 6/10 | → | No |
| 2 — Validación REST (Zod) | `backend-capa-2-rest-controllers.md` | **8/10** | ↑↑ | 3 tareas pendientes |
| 3 — Controllers gRPC | `backend-capa-3-grpc-controllers.md` | 6/10 | → | No |
| 4+5 — Domain/Repository | `backend-capas-4-5-domain-repo.md` | **4/10** | ↑ | Constructor pendiente |
| 6 — Multi-tenant | `backend-capa-6-multitenant.md` | 5/10 | → | Auditoría pendiente |

## Progreso de hoy (resumen de sesión)

| Qué | Estado |
|-----|--------|
| ZodValidationPipe + filters en 3 servicios | ✅ |
| schemas.ts Zod en ~15 módulos de chatia | ✅ |
| 11 controllers chatia migrados a Zod | ✅ |
| 1 controller workers migrado a Zod | ✅ |
| class-validator eliminado de 3 package.json | ✅ |
| conversations.module.ts con Repository binding | ✅ |
| payments.module.ts con Repository binding | ✅ |
| domain/ + repository/ para conversations y payments | ✅ |
| grpc-contracts.md documentado | ✅ |
| auditoria-multitenant.md generada | ✅ |

## Para mañana — en orden de prioridad

1. **Eliminar carpetas dto/ huérfanas** (Capa 2: 8→9)
   → Ver lista completa en `backend-capa-2-rest-controllers.md`

2. **Migrar 8 archivos restantes con class-validator inline** (Capa 2: 9→10)
   → analytics.controller, channel-accounts.service, contacts.service,
     notifications.controller (chatia), widget.controller,
     notificaciones notifications.controller, tenants.controller

3. **Conectar constructores** (Capa 4+5: 4→6)
   → ConversationsService → IConversationsRepository
   → PaymentsService → IPaymentsRepository

4. **Registrar AllExceptionsFilter en main.ts** de chatia y workers
