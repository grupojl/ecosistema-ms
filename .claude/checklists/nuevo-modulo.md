# Checklist: Nuevo módulo en microservicio existente

> Era Zod + Domain/Repository. `class-validator` está eliminado (ADR-001 completado).
> Actualizado por x.sh — norte Stripe/Linear.

## Antes de empezar

- [ ] Leí `.claude/architecture/00-principios.md`
- [ ] Leí `.claude/services/{servicio}.md`
- [ ] Definí el bounded context y sus invariantes de dominio
- [ ] Definí los contratos (tipos de entrada y salida) antes de escribir código
- [ ] Verifiqué que este dominio no existe ya en otro módulo del mismo servicio

## Estructura de archivos

- [ ] Controller en `{servicio}/src/{dominio}/{dominio}.controller.ts`
      — nunca en carpeta de otro dominio
      (ver 🔴 `controller-localidad` en `architecture/03-reglas-duras.md`)
- [ ] `domain/{entidad}.entity.ts` — tipos puros TypeScript, sin NestJS ni Prisma
- [ ] `domain/{entidad}.errors.ts` — DomainErrors tipados, sin NestJS
- [ ] `repository/{dominio}.repository.interface.ts` — símbolo TOKEN + interface
- [ ] `repository/prisma-{dominio}.repository.ts` — único archivo con PrismaService + toEntity()
- [ ] `types/{dominio}.types.ts` — tipos de salida del service (nunca tipo Prisma crudo)
- [ ] `schemas.ts` — Zod inline, colocalizados con el controller
- [ ] `{dominio}.service.ts` — lógica de dominio, inyecta IRepository via `@Inject(TOKEN)`
- [ ] `{dominio}.controller.ts` — surface HTTP únicamente, sin lógica de negocio
- [ ] `{dominio}.module.ts` — binding `{ provide: TOKEN, useClass: PrismaRepo }`
- [ ] `index.ts` — exporta Module, Service y tipos públicos; internals quedan privados
- [ ] Módulo registrado en `app.module.ts`

## Validación de entrada — schemas.ts — Zod inline

- [ ] Schemas Zod definidos en `schemas.ts` del módulo (no en `dto/`)
- [ ] `ZodValidationPipe(Schema)` en cada endpoint con `@Body()` o `@Query()`
- [ ] Tipos inferidos con `z.infer<typeof Schema>` — sin clases DTO
- [ ] `z.coerce.number()` para query params numéricos (llegan como string en HTTP)
- [ ] Sin `class-validator`, sin `class-transformer` en el `package.json`

## Domain / Repository

- [ ] `{entidad}.entity.ts` no importa nada de NestJS ni Prisma
- [ ] Invariantes implementadas como funciones puras (`assert*`) que lanzan `DomainError`
- [ ] `IRepository` define el contrato sin métodos específicos de Prisma
- [ ] `PrismaRepository.toEntity()` convierte tipo Prisma → tipo de dominio
- [ ] El service NO importa `PrismaService` directamente
- [ ] El module hace el binding: `{ provide: TOKEN, useClass: PrismaRepo }`

## Tipos de salida

- [ ] El service devuelve tipos de `types/{dominio}.types.ts` — nunca tipo Prisma crudo
- [ ] `toOutput()` implementado en el service para cada método público
- [ ] El controller recibe el output del service y lo retorna directamente

## Encapsulamiento

- [ ] Ningún archivo de `domain/` ni `repository/` importado desde otro módulo
      (ver 🔴 `no-cross-import-mismo-servicio` en `architecture/03-reglas-duras.md`)
- [ ] `index.ts` exporta solo lo que otros módulos necesitan consumir
- [ ] Si otro módulo consume este módulo, importa desde `index.ts` — nunca de internals

## Multi-tenancy

- [ ] Toda query Prisma lleva `ecosystemId` + `organizationId` en el `where`
- [ ] `TenantGuard` aplicado en el controller
- [ ] `TenantContext` tipado pasado como parámetro al service — nunca leído del request en el service

## Manejo de errores

- [ ] `DomainError` lanzados en `domain/` — sin imports de NestJS
- [ ] El service captura `DomainError` y lanza `HttpException` tipada
- [ ] Sin `throw new Error('string')` — siempre errores con tipo y nombre
- [ ] El controller no captura excepciones — delega al `AllExceptionsFilter` global

## Tests

- [ ] Unit test del service con repository mockeado via interface (no mock de PrismaService)
- [ ] Unit test de las funciones puras en `domain/*.entity.ts`
- [ ] `TenantContext` mockeado con el mock canónico de `checklists/testing-desde-cero.md`
- [ ] Cobertura ≥ 85% en paths críticos

## Documentación

- [ ] Endpoints listados en `.claude/services/{servicio}.md`
- [ ] Archivo `.claude/modules/{servicio}/{dominio}.md` creado con responsabilidad e invariantes
