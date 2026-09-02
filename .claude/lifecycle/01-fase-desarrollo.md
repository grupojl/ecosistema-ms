# Fase 1 — Desarrollo
## Escalones 1, 2, 4 — La base que hace cosmético todo lo demás

**Estado:** 🔴 En curso
**Cuándo:** Ahora, antes de cualquier otra fase
**Referentes:** Stripe (código) · Twelve-Factor App (config) · PlanetScale (DB)

---

## Escalón 1 — Código: Arquitectura y Calidad

### Qué significa para ecosistema-ms

Estructura limpia, TypeScript strict sin `any`, separación de capas,
validación defensiva en todos los límites del sistema.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| TypeScript strict | ⚠️ Parcial | Activado pero con `as any` implícitos por falta de `toEntity()` |
| Separación de capas | ❌ No iniciado | Services con Prisma directo — sin Domain/Repository |
| Validación de entrada | ❌ BLOQUEANTE | `class-validator` DTOs en todos los servicios |
| Arquitectura gRPC | ✅ Implementado | Contratos `.proto` definidos, grpc-client disponible |
| Sin cross-service imports | ✅ Implementado | Monorepo respeta fronteras por Dockerfile |
| Multi-tenant scope | ⚠️ Parcial | `ecosystemId` + `organizationId` no consistente en todos los queries |

### Qué hay que hacer (en orden)

1. **Migrar DTOs a Zod** — `.claude/checklists/backend-capa-2-rest-controllers.md`
   `class-validator` es el síntoma. El problema de fondo es que la validación
   no produce tipos de dominio — Zod sí.

2. **Crear Domain/Repository con MOLDE VIVO** — `.claude/checklists/backend-capas-4-5-domain-repo.md`
   Empezar por `chatia-backend/conversations/`. Una vez migrado, es el molde
   que todos los demás módulos siguen.

3. **Eliminar `as any` y `as unknown as`** — agregar `toEntity()` privado en
   cada repository. Ver patrón en `.claude/decisions/ADR-002-domain-repo.md`.

4. **Scope consistente** — todo query Prisma lleva `ecosystemId` + `organizationId`.
   Ver `.claude/checklists/backend-capa-6-multitenant.md`.

### Cómo saber que este escalón está completo

- `tsc --noEmit` pasa sin errores en los 5 servicios
- Cero `class-validator` en ningún `package.json`
- Cero `as any` fuera de `// @ecosistema-ms/jsonb-cast`
- `conversations/` de chatia-backend tiene `domain/` + `repository/` con `toEntity()`
- `payments/` de pasarelapagos-backend tiene `domain/` + `repository/`
- Todo query Prisma tiene `ecosystemId` en el `where`

### Referente: por qué Stripe

La API de Stripe es el estándar de ergonomía y tipado. Cada método retorna
un tipo explícito, cada error está tipado, cada input está validado.
Si un ingeniero nuevo puede leer el código de un módulo y entender qué hace
sin preguntar — el escalón 1 está bien.

---

## Escalón 2 — Configuración y Entorno

### Qué significa para ecosistema-ms

Separación estricta de variables por entorno, credenciales fuera del código,
catalog único de dependencias, configuración declarativa por servicio.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Catalog único pnpm | ✅ Implementado | `catalog:` default — sin named catalogs |
| Variables por Dockerfile | ✅ Implementado | `ARG`/`ENV` declarados en cada Dockerfile |
| Sin `.env` compartido | ✅ Implementado | Cada servicio declara sus propias vars |
| URLs gRPC por env var | ✅ Implementado | `CHATIA_GRPC_URL`, `PAGOS_GRPC_URL`, etc. |
| Secretos fuera del código | ⚠️ Verificar | Firebase private key — confirmar que no está en repo |
| `.env.example` por servicio | ⚠️ Verificar | Documentar todas las vars requeridas |

### Qué hay que hacer

1. **Verificar que no hay secretos en el repo** — Firebase private key, API keys
   de MercadoPago/Stripe, Redis password — nunca en el código.

2. **Crear `.env.example` por servicio** con todas las variables requeridas
   y su descripción. Sin valores reales — solo la forma.

3. **Documentar vars de entorno gRPC** — confirmar que todos los servicios
   tienen las variables de los otros servicios correctamente nombradas.

4. **Validación de configuración al arranque** — cada `main.ts` debe fallar
   con un mensaje claro si falta una variable obligatoria. No arrancar con
   configuración incompleta.

```ts
// Patrón correcto — validar al arranque
const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'FIREBASE_PROJECT_ID'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

### Cómo saber que este escalón está completo

- `git grep -r "PRIVATE_KEY\|SECRET\|PASSWORD" --include="*.ts"` → cero resultados con valores reales
- Cada servicio tiene `.env.example` completo
- El servicio falla en arranque con mensaje claro si falta una var

### Referente: Twelve-Factor App

La metodología que estandarizó la configuración moderna. Factor III:
"Store config in the environment". Sin valores en el código, sin
configuración que cambia entre entornos en el repo.

---

## Escalón 4 — Base de Datos y Almacenamiento

### Qué significa para ecosistema-ms

Migraciones versionadas y automáticas, pool de conexiones gestionado,
backups automáticos, schema como fuente de verdad.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| Prisma ORM | ✅ Implementado | Schema declarativo en cada servicio |
| Migraciones versionadas | ✅ Implementado | `prisma/migrations/` en cada servicio |
| Pool de conexiones | ⚠️ Verificar | Prisma gestiona el pool — confirmar límites por servicio |
| Backups automáticos | ⚠️ Railway | Railway provisiona PostgreSQL — verificar política de backups |
| DB separada por servicio | ✅ Implementado | Cada microservicio tiene su `DATABASE_URL` propia |
| DB separada por ecosistema | ⚠️ Verificar | Confirmar que welver, manzana, mexus usan DBs distintas |
| Índices en campos de tenant | ⚠️ Parcial | `@@index([ecosystemId, organizationId])` — verificar cobertura |

### Qué hay que hacer

1. **Verificar índices compuestos** — todo modelo con `ecosystemId` +
   `organizationId` debe tener `@@index([ecosystemId, organizationId])` en
   el schema de Prisma. Sin índice = query lento a escala.

2. **Confirmar política de backups en Railway** — qué RPO tiene cada base de
   datos. Si Railway no garantiza el RPO que necesitamos, agregar backup
   externo (S3 o similar).

3. **Confirmar límites del pool de conexiones** — por defecto Prisma abre
   hasta N conexiones. Con 5 microservicios + múltiples réplicas, el límite
   de conexiones de PostgreSQL puede ser un cuello de botella.

4. **Migración en deploy automático** — confirmar que `prisma migrate deploy`
   corre antes del arranque del servicio en Railway, no después.

5. **Semilla de datos de ecosistemas** — confirmar que welver, manzana, mexus
   tienen sus registros base en las tablas correspondientes.

### Cómo saber que este escalón está completo

- Todo modelo con tenant scope tiene `@@index([ecosystemId, organizationId])`
- `prisma migrate deploy` corre en el Dockerfile antes del `CMD`
- Backups automáticos confirmados con RPO documentado
- Pool de conexiones documentado por servicio

### Referente: PlanetScale

Migraciones sin tiempo de inactividad, branching de schema, connection pooling
automático. El estándar que Railway intenta aproximar. El principio clave:
el schema nunca es una sorpresa — está versionado y la migración es atómica.
