# ADR-002: Patrón Domain/Repository en módulos con lógica de negocio compleja

**Fecha:** (al ejecutar este script)
**Estado:** Aceptado — PENDIENTE DE IMPLEMENTAR

## Contexto

Todos los services de ecosistema-ms importan `PrismaService` directamente
y ejecutan queries Prisma inline. Esto acopla la lógica de negocio a la
base de datos de tres formas:

1. Las reglas de negocio (ej: "una conversación no puede volver a estado OPEN
   desde CLOSED") viven en el service mezcladas con queries Prisma
2. Testear el service requiere mockear Prisma — costoso y frágil
3. Los `as unknown as TipoEntidad` silencian errores de tipo cuando Prisma
   devuelve un tipo diferente al tipo de dominio

**Referencia:** En `grupojl/welver`, `realsass-sass-back` tiene 11 módulos
con Domain + Repository implementado. El molde es `catalog/` en
`realsass-ecommerce-back`. En ecosistema-ms, el molde será
`chatia-backend/src/conversations/` una vez migrado.

## Decisión

**Aplicar Domain + Repository en módulos con lógica de negocio compleja.**

No todos los módulos necesitan esta separación. Criterio:
- ✅ Aplica: módulo con estados, transiciones, invariantes, o múltiples queries relacionadas
- ⚠️ Evaluar: módulo CRUD simple sin lógica — puede quedarse con Prisma directo si es simple
- ❌ No aplica: controllers gRPC (son adaptadores de transporte)

**Prioridad de migración:**
1. `chatia-backend/conversations/` — MOLDE VIVO
2. `pasarelapagos-backend/payments/` — lógica financiera crítica
3. Los demás módulos en orden de complejidad

## Patrón

```
modulo/
├── domain/
│   ├── entidad.entity.ts        # tipos puros TypeScript — sin imports de NestJS ni Prisma
│   └── entidad.errors.ts        # DomainError tipados que el Service puede lanzar
├── repository/
│   ├── modulo.repository.interface.ts   # puerto (símbolo + interface TypeScript)
│   └── prisma-modulo.repository.ts     # adaptador — único lugar con Prisma + toEntity()
├── modulo.service.ts            # inyecta IRepository via @Inject(TOKEN) — sin PrismaService
└── modulo.module.ts             # binding: { provide: TOKEN, useClass: PrismaRepo }
```

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Mantener Prisma directo en services | Testear es costoso, los tipos no son verificados, la lógica y la infraestructura están mezcladas |
| ActiveRecord (Prisma como dominio) | Viola inversión de dependencias — el dominio dependería de Prisma |
| CQRS completo | Overhead innecesario para este tamaño de sistema |

## Consecuencias

**Ganancia:**
- Domain testeable sin mocks de Prisma
- `toEntity()` verifica el mapeo Prisma → dominio en compile time
- Service sin acoplamiento a Prisma — puede cambiar de ORM sin tocar el service

**Costo:**
- ~10-15 módulos a migrar entre los 5 servicios
- Trabajo estimado: 4-6 sesiones de desarrollo

**Regla permanente:**
Un `*.service.ts` post-migración que importa `PrismaService` directamente es un bug.
Se bloquea en code review.

## Referencias

- `checklists/backend-capas-4-5-domain-repo.md`
- `architecture/03-reglas-duras.md`
