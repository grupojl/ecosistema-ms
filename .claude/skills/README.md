# Skills del monorepo ecosistema-ms

Procedimientos que Claude Code carga **solo cuando la tarea coincide** con su descripción (`SKILL.md` → `description`).
Cada uno es corto: apunta a scripts probados y a los ADR/arquitectura, no los copia. Los scripts son Node puro (sin dependencias) y
funcionan en Windows, macOS y Linux. Se corren desde la raíz del repo.

| Skill | Cuándo | Script |
|---|---|---|
| [`verify`](verify/SKILL.md) | Antes de dar algo por terminado / commit / PR | `verify.js`, `pg-temp.js` |
| [`audit-service`](audit-service/SKILL.md) | Puntuar un servicio (rúbrica fija, topes) | `metrics.js` |
| [`security-review-tenant`](security-review-tenant/SKILL.md) | Cambios en controllers, guards, repositories, auth | `scan.js` |
| [`docs-sync`](docs-sync/SKILL.md) | Tras mudanzas o cambios de reglas | `check-paths.js` |
| [`new-module`](new-module/SKILL.md) | Nuevo bounded context / endpoint (ADR-022) | — |
| [`new-ecosystem`](new-ecosystem/SKILL.md) | Sumar un ecosistema (strategy + config) | — |
| [`replicate-architecture`](replicate-architecture/SKILL.md) | Migrar un servicio a ADR-022 | `../tools/restructure-src.js` |
| [`deploy-railway`](deploy-railway/SKILL.md) | Staging / producción en Railway | `required-env.js`, `smoke-webhook.js` |
| [`bullmq-job`](bullmq-job/SKILL.md) | Colas, jobs, processors | — |
| [`grpc-contract`](grpc-contract/SKILL.md) | Cambios en `.proto` / llamadas inter-servicio | — |
| [`provider-adapter`](provider-adapter/SKILL.md) | Proveedores externos, fallback, circuit breaker | — |

## Orden típico de un cambio
`new-module` (o el cambio) → `verify` → `security-review-tenant` → `docs-sync` → `audit-service` (si se pide nota) → `deploy-railway`.

## Reglas de mantenimiento
1. **Mantenerlos finos.** Si un skill empieza a copiar contenido de un ADR, enlazar al ADR en su lugar.
2. **Un cambio de regla = actualizar el skill afectado** en el mismo commit (lo detecta `docs-sync` si cita rutas).
3. **Probar los scripts** cuando cambie la estructura de un servicio (hoy solo chatia cumple ADR-022; el resto de servicios se mide igual pero marca la deuda).
4. La **descripción** decide si el skill se activa: escribirla con las frases que usaría el usuario.
5. Un skill nuevo se agrega a esta tabla.

## Pendiente (no incluido a propósito)
Hooks (`settings.json`), subagente revisor y lista de permisos de comandos: cambian el comportamiento del entorno y se aplican por separado.
