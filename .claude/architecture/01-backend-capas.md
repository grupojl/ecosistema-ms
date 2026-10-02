# Backend — 5 microservicios

| # | Capa | Ideal terminado | Regla dura | Estado hoy |
|---|------|-----------------|------------|------------|
| 1 | Auth/Tenant resolution | `@ecosistema-ms/auth-server` — un solo `TenantGuard` + `FirebaseAuthGuard` consumido por todos los servicios. | Ningún servicio reimplementa verificación Firebase a mano. | ⚠️ parcial — guards en auth-server pero cada servicio los aplica de forma diferente |
| 2 | Validación de entrada (REST) | Zod inline en cada controller REST. Sin `class-validator`. Sin DTOs de NestJS. | Cero DTOs nuevos con `class-validator`. Todo input nuevo = schema Zod. | ❌ bloqueante — todos los servicios tienen DTOs con class-validator |
| 3 | Controlador gRPC | Recibe el request proto, delega al Service, retorna el response proto. Cero lógica de negocio en el controller gRPC. | Un controller gRPC que tiene un `if` de negocio es un bug de arquitectura. | ⚠️ parcial — algunos controllers tienen lógica |
| 4 | Domain / Repository | `domain/` = reglas de negocio puras. `repository/` = adaptador Prisma con `toEntity()`. Service inyecta `IRepository` via `@Inject(TOKEN)`. | Ningún `*.service.ts` importa `PrismaService` directamente (post-migración). | ❌ no implementado — todos los services hacen Prisma directo |
| 5 | Contrato gRPC tipado | `packages/proto` define el contrato. `packages/grpc-client` expone el cliente tipado. Cambiar un .proto sin actualizar el cliente = falla de compilación. | Un servicio que llama a otro por HTTP cuando existe el .proto es un bug. | ✅ estructura existe — `packages/proto/proto/*.proto` definidos |
| 6 | Multi-tenant como invariante transversal | Todo modelo con datos de negocio lleva `ecosystemId` + `organizationId`. Todo repository method recibe ambos como parámetro obligatorio. | Un query sin `ecosystemId` en el `where` es filtración de datos entre clientes. | ⚠️ parcial — algunos services filtran correctamente, otros no |

## Módulo de referencia (MOLDE VIVO a crear)

`chatia-backend/src/conversations/` será el **MOLDE VIVO** una vez migrado
a Domain + Repository. Todos los módulos dinámicos seguirán la misma estructura.

## Patrón correcto de módulo

```
modulo/
├── domain/
│   ├── entidad.entity.ts          # tipos puros — sin NestJS, sin Prisma
│   └── entidad.errors.ts          # DomainError tipados
├── repository/
│   ├── modulo.repository.interface.ts   # puerto (símbolo + interface)
│   └── prisma-modulo.repository.ts     # adaptador — único lugar con Prisma + toEntity()
├── types/
│   └── modulo.types.ts            # tipos de salida — nunca Prisma crudo al exterior
├── schemas.ts                     # Zod schemas — colocalizados con el controller
├── modulo.controller.ts           # ← VIVE AQUÍ — no en otro módulo ni en otra carpeta
├── modulo.service.ts              # inyecta IRepository via @Inject(TOKEN)
└── modulo.module.ts               # binding: { provide: TOKEN, useClass: PrismaRepo }
```

### Regla de localidad

El controller HTTP de un dominio **vive en la carpeta de ese dominio**.
Si el controller está en otra carpeta, la API del módulo es invisible para
quien lee el código — viola el principio de colocalización.

Excepciones transversales aceptadas (por diseño, no por dominio):
- `health/health.controller.ts`
- `internal/internal.controller.ts`
- `grpc/{servicio}-grpc.controller.ts`

Ver regla completa: `.claude/architecture/03-reglas-duras.md` → `controller-localidad`

---

## Contrato público de módulo — index.ts <!-- id: index.ts como contrato público -->

> Norte Stripe/Linear: lo que no está en index.ts es privado.

Cada módulo con lógica de dominio expone un `index.ts` que declara
explícitamente qué puede ser consumido desde fuera del módulo.

**Qué exporta `index.ts`:**

```ts
// contacts/index.ts — contrato público del módulo contacts
export { ContactsModule }  from './contacts.module';
export { ContactsService } from './contacts.service';
export type { ContactOutput, ContactStatsOutput } from './types/contact.types';
// NO se exporta: PrismaContactsRepository, contact.errors, contact.entity
// — esos son internos del módulo
```

**Estructura completa con index.ts:**

```
contacts/
├── domain/                 # privado — no importable desde fuera
├── repository/             # privado — no importable desde fuera
├── types/
│   └── contact.types.ts   # exportado via index.ts cuando se necesita
├── schemas.ts              # privado — solo el controller lo usa
├── contacts.controller.ts
├── contacts.service.ts    # exportado via index.ts
├── contacts.module.ts     # exportado via index.ts
└── index.ts               # ← frontera explícita del módulo
```

**Regla de adopción:**
- Módulos nuevos: `index.ts` obligatorio desde el primer commit.
- Módulos existentes: agregar `index.ts` al migrar a Domain/Repository.
- Sin `index.ts`: el módulo se trata como privado completo — ningún archivo
  interno es importable desde afuera hasta que se cree el `index.ts`.

**Por qué importa:**
Sin `index.ts`, cualquier refactor interno rompe consumidores silenciosamente.
Con `index.ts`, el compilador detecta la rotura en el primer `tsc --noEmit`.
