# Checklists 10/10 por capa

Cada archivo es la guía para llevar esa capa al máximo nivel en ecosistema-ms.

## Backend (aplica a los 5 microservicios)

| Capa | Archivo | Score actual | Nivel |
|---|---|---|---|
| 1 — Auth/Tenant | `backend-capa-1-auth.md` | 6/10 | Startup |
| 2 — Validación REST (Zod) | `backend-capa-2-rest-controllers.md` | 2/10 | ❌ BLOQUEANTE |
| 3 — Controllers gRPC | `backend-capa-3-grpc-controllers.md` | 6/10 | Funcional |
| 4+5 — Domain/Repository | `backend-capas-4-5-domain-repo.md` | 1/10 | No iniciado |
| 6 — Multi-tenant | `backend-capa-6-multitenant.md` | 5/10 | Parcial |

## Cómo usar estos archivos

1. Al iniciar una sesión de trabajo, leer el checklist de la capa que se va a trabajar
2. Los ítems `- [ ]` son tareas concretas para llegar a 10/10
3. Los ítems `- [x]` están completos — no retroceder
4. Los marcados como `BLOQUEANTE` deben resolverse antes que cualquier otra tarea

## Progreso hacia 10/10 — orden de impacto

1. **Eliminar DTOs class-validator** (Capa 2: 2→8) — BLOQUEANTE activo
2. **Domain/Repository en conversations + payments** (Capa 4+5: 1→5)
3. **Scope ecosystemId+organizationId consistente** (Capa 6: 5→9)
4. **Tests 85% cobertura** (todas las capas: +0.5 cada una)
5. **Enforcement CI (dependency-cruiser + ESLint)** (todas: +0.5 cada una)
