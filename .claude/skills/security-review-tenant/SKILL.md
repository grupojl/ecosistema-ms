---
name: security-review-tenant
description: Revisión de seguridad multi-tenant de un microservicio del monorepo — endpoints sin guard, identidad tomada del body, consultas Prisma sin filtro de tenant, webhooks sin firma, body sin validación. Usar antes de cada PR que toque controllers, guards, repositories o auth, al agregar un endpoint, y cuando el usuario pida "revisá la seguridad", "hay fugas entre tenants" o "es seguro".
---

# security-review-tenant

Este sistema es **multi-tenant** (ecosistema → organización). El error más caro es que un tenant lea o escriba datos de otro, o
que alguien sin autenticar escriba en cualquier organización.

## Procedimiento
1. Correr el escáner (heurístico: marca lo que hay que mirar, no prueba nada):
   ```bash
   node .claude/skills/security-review-tenant/scripts/scan.js chatia-backend
   ```
   Sale con código 1 si hay hallazgos **ALTA**.
2. **Verificar a mano cada ALTA** leyendo el código. No cerrar un hallazgo sin leer el archivo.
3. Revisar las MEDIA: la mayoría son consultas cuyo `where` se armó antes. Confirmar que el ownership se verifica ANTES (un `findFirst` con `organizationId`).
4. Pasar la checklist de abajo a los archivos del diff.
5. Cada hallazgo real se corrige **con un test** que falle sin el arreglo (ver "Cómo probar").

## Qué detecta el escáner
| Regla | Severidad | Significado |
|---|---|---|
| `endpoint-sin-guard` | ALTA | Ruta sin `@UseGuards` (ni a nivel de clase). Los públicos por diseño están listados (health, widget, webhooks) |
| `identidad-del-body` | ALTA | Usa `dto.organizationId/firebaseUid/ecosystemId/role`: la identidad debe salir del token |
| `webhook-sin-firma` | ALTA | No hay verificación HMAC en el servicio |
| `listado-sin-tenant` | MEDIA | `findMany/count/deleteMany…` sin `organizationId` ni clave acotada por un tenant |
| `body-sin-validacion` | MEDIA | `@Body()` sin `ZodValidationPipe` |
| `config-riesgosa` | MEDIA | `rejectUnauthorized:false`, CORS `*` |
| `mutacion-por-id`, `auth-por-clave`, `publico-por-diseño` | INFO | Revisar el contexto |

## Checklist manual (lo que el escáner no ve)
- [ ] Toda ruta nueva tiene guard o está justificada como pública en el PR.
- [ ] La identidad (`organizationId`, `ecosystemId`, `firebaseUid`, rol) viene de `@Tenant()`, **nunca** del body/query/params.
- [ ] Operaciones sobre un recurso por `id` verifican antes que el recurso es de la organización (`findFirst({ where: { id, organizationId } })`).
- [ ] Cambios de **rol, permisos o estado (`isActive`)** solo para OWNER/ADMIN; un miembro solo edita su propio perfil.
- [ ] Un upsert **no mueve** un registro existente a otra organización.
- [ ] Webhooks: firma sobre el **cuerpo crudo**, comparación en tiempo constante, rechazo si falta secreto o firma.
- [ ] Secretos y tokens de terceros **cifrados en reposo** y nunca devueltos por la API ni escritos en logs/URLs (token en header, no en query string).
- [ ] Lo que descarga URLs externas (FAQ, media) está protegido contra SSRF.
- [ ] Respuestas de error no filtran detalles internos (stack, SQL, claves).
- [ ] Endpoints públicos tienen límites (rate limit/cuota) propios.
- [ ] Un job de BullMQ que actúa sobre datos lleva `organizationId` en su payload y lo usa al consultar.

## Cómo probar un arreglo
- Unitario: el service rechaza (403/404) con un actor de otra organización o sin permiso.
- **Integración contra Postgres real** (skill `verify --integration`): crear dos tenants y comprobar que A no ve ni modifica a B.
  Ejemplos en `src/infrastructure/testing/integration/`.

## Reglas
- Un hallazgo ALTA real **bloquea el PR** y topa la nota del servicio en 7,0 (ver `audit-service`).
- Si el cambio de seguridad rompe el contrato con un frontend (p. ej. un endpoint que ahora exige token), **decirlo explícitamente** al usuario.
- No "arreglar" silenciando el escáner: si algo es público por diseño, se agrega a `PUBLIC_BY_DESIGN` en `scan.js` con su motivo.
