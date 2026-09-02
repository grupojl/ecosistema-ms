# Backend Capa 6 — Multi-tenant como invariante transversal
# Checklist 10/10

**Score actual: 5/10 — Parcial**
**Score objetivo: 10/10**

## Diferencia clave vs ecosistema (welver/)

En ecosistema-ms el scope de tenant es DOBLE:
- `ecosystemId` — identifica al cliente de la plataforma (welver, manzana, mexus, etc.)
- `organizationId` — identifica la organización dentro del ecosistema

**Todo query Prisma debe llevar AMBOS filtros obligatoriamente.**

## ✅ Completado

- [x] Modelos Prisma en chatia-backend tienen `ecosystemId` en las tablas principales
- [x] `TenantGuard` resuelve ambos IDs del token Firebase
- [x] `@Tenant()` decorator disponible para extraer el contexto

## ⏳ Pendiente para 10/10

### Auditoría de queries sin scope (BLOQUEANTE)
- [ ] `chatia-backend` — auditar todos los `this.prisma.X.findMany()` sin `ecosystemId`
- [ ] `chatia-backend` — auditar `this.prisma.X.findFirst()` sin `ecosystemId`
- [ ] `pasarelapagos-backend` — verificar scope en todas las queries de payments
- [ ] `notificaciones-backend` — verificar scope en todas las queries
- [ ] `analytics-backend` — verificar scope en todos los event queries
- [ ] `workers-backend` — verificar scope en campaigns

### Schema Prisma — verificar cobertura
- [ ] Verificar que TODOS los modelos con datos de negocio tienen `ecosystemId` String
- [ ] Verificar que TODOS los modelos relevantes tienen `organizationId` String
- [ ] Los índices compuestos `@@index([ecosystemId, organizationId])` existen donde corresponde

### Repository (cuando existan las capas 4+5)
- [ ] Todo method de repository recibe `ecosystemId` + `organizationId` como parámetro obligatorio
- [ ] Ningún repository method acepta queries sin scope

### Tests de seguridad
- [ ] Test: request con `ecosystemId` de otro cliente → 403 o resultado vacío
- [ ] Test: request con `organizationId` de otra org del mismo ecosistema → vacío
- [ ] Test: query cross-tenant devuelve 0 resultados (no error, no data ajena)

### Enforcement CI
- [ ] ESLint rule `@ecosistema-ms/no-unscoped-prisma-query`
  → Detecta `this.prisma.model.findMany()` sin `ecosystemId` en el `where`

## Regla dura

Un query sin `ecosystemId` en el `where` es un bug crítico de seguridad.
Se bloquea el PR — no se mergea con ticket de deuda.
La filtración de datos entre clientes es un fallo de nivel 0.
