# Checklist: Nuevo módulo en microservicio existente

## Antes de empezar
- [ ] Leí `.claude/architecture/00-principios.md`
- [ ] Leí `.claude/services/{servicio}.md`
- [ ] Definí el bounded context del módulo y sus invariantes de dominio
- [ ] Definí los contratos (DTOs, interfaces) antes de implementar

## Estructura
- [ ] `{dominio}.module.ts` creado
- [ ] `{dominio}.service.ts` — lógica de dominio únicamente
- [ ] `{dominio}.controller.ts` — solo surface HTTP, sin lógica
- [ ] `dto/` — DTOs con `class-validator` decorators
- [ ] Módulo registrado en `app.module.ts`

## Multi-tenancy
- [ ] Toda query lleva `ecosystemId` + `organizationId`
- [ ] `TenantGuard` en el controller
- [ ] `TenantContext` pasado como parámetro tipado al service

## Prisma
- [ ] No hay queries N+1 — todo `include` explícito
- [ ] Si hay nueva entidad: migration creada y testeada localmente
- [ ] Schema actualizado en `prisma/schema.prisma`

## Manejo de errores
- [ ] Errores tipados con excepciones NestJS (`NotFoundException`, `BadRequestException`, etc.)
- [ ] Sin `throw new Error('string')` en services

## Tests
- [ ] Unit test del service (mock de Prisma con `mockDeep`)
- [ ] Unit test del controller
- [ ] TenantContext mockeado correctamente
- [ ] Cobertura ≥ 85% en paths críticos

## Documentación
- [ ] Endpoints documentados con `@ApiTags`, `@ApiOperation`, `@ApiResponse`
- [ ] Archivo `.claude/modules/{servicio}/{dominio}.md` creado o actualizado
