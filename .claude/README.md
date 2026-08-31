# .claude/ — Contexto para IA — ecosistema-ms

Mismo patron que welver/ — documentacion de arquitectura, contratos y
convenciones del monorepo `grupojl/ecosistema-ms`.

## Como navegar este directorio

```
.claude/
  CLAUDE.md                        # Leer primero — resumen del ecosistema
  README.md                        # Este archivo — indice de navegacion
  architecture/
    00-principios.md               # Principios generales
    01-capas-microservicio.md      # Estructura de carpetas por capa
    02-grpc-inter-servicio.md      # Comunicacion gRPC
    03-reglas-duras.md             # Reglas con enforcement — NO negociables
    04-degradacion-elegante.md     # Patrones de fallback
  services/
    chatia-backend.md              # Ficha tecnica con score y estado real
    pasarelapagos-backend.md
    notificaciones-backend.md
    analytics-backend.md
    workers-backend.md
    packages.md
  contracts/
    grpc-contracts.md              # Protos y proceso de cambio
    tenant-context.md              # TenantContext, upsert pasivo, filtros
    bullmq-queues.md               # Queues y jobs por microservicio
  conventions/
    deploy.md
    entorno.md
    testing.md
  decisions/
    TEMPLATE.md
    ADR-001 a ADR-007
  modules/
    chatia-backend/ notificaciones-backend/ analytics-backend/
    workers-backend/ pasarelapagos-backend/
  checklists/
    README.md ms-capa-1 a ms-capa-6
    testing-desde-cero.md observabilidad.md circuit-breaker-adapters.md
  roadmap/
    sprints.md deuda-tecnica.md
