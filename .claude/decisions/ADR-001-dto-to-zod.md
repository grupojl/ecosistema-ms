# ADR-001: Eliminar class-validator DTOs — migrar a Zod inline en controllers REST

**Fecha:** (al ejecutar este script)
**Estado:** Aceptado — PENDIENTE DE IMPLEMENTAR

## Contexto

Todos los microservicios de ecosistema-ms usan el patrón NestJS clásico de
`class-validator` + `class-transformer` DTOs para validar la entrada de los
controllers REST. Este patrón tiene tres problemas:

**Problema 1 — Los tipos de los DTOs no fluyen al dominio:**
Los DTOs de NestJS son clases con decorators. El tipo TypeScript que producen
es el de la clase DTO, no el tipo de dominio. Se necesita mapear manualmente
DTO → dominio, o peor, se usa `as any`.

**Problema 2 — Validación separada del uso:**
El schema de validación (decorators en la clase DTO) está separado del lugar
donde se usa el dato (el controller). Cuando cambia el contrato, hay que
actualizar ambos lugares.

**Problema 3 — class-transformer tiene comportamientos sorpresivos:**
La transformación implícita de tipos (string → number, string → Date) puede
producir bugs silenciosos difíciles de trazar.

**Referencia:** Este mismo problema se resolvió en `grupojl/welver`
con la migración REST → tRPC (ADR-005 de welver). En ecosistema-ms
no hay tRPC (comunicación es gRPC), pero el principio de Zod inline
es el mismo.

## Decisión

**Migrar toda validación de entrada REST a Zod inline en el controller.**

```ts
// ❌ ANTES — class-validator DTO (prohibido en código nuevo)
@Post()
async createContact(@Body() dto: CreateContactDto) { ... }

// ✅ DESPUÉS — Zod inline en el controller
const CreateContactSchema = z.object({
  name:  z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
});
type CreateContactInput = z.infer<typeof CreateContactSchema>;

@Post()
async createContact(
  @Body(new ZodValidationPipe(CreateContactSchema)) dto: CreateContactInput
) { ... }
```

**Los controllers gRPC quedan exentos.** protobuf valida la estructura en el
transporte. La validación de negocio (valores fuera de rango, invariantes de
dominio) va en el Service o en el Domain.

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|---|---|
| Mantener class-validator | No resuelve el problema de tipos — el DTO sigue siendo una clase, no un tipo de dominio |
| Migrar a tRPC como welver | ecosistema-ms usa gRPC para comunicación inter-servicio; tRPC es para front→back. Innecesario aquí. |
| Zod en un pipe global genérico que lee decorators | Más complejo que Zod inline; mezcla dos sistemas de validación |

## Consecuencias

**Ganancia:**
- `z.infer<typeof Schema>` produce el tipo TypeScript directamente — sin mapeo
- Schema y uso colocalizados en el mismo archivo — fácil de mantener
- Errores de validación tipados y estructurados (ZodError → 400)
- `class-validator` y `class-transformer` eliminados de todas las dependencias

**Costo:**
- ~20 DTOs en chatia-backend + 2 en pagos + 3 en workers a migrar
- Requiere `ZodValidationPipe` y `ZodExceptionFilter` globales en cada servicio
- Trabajo estimado: 2-3 sesiones de desarrollo

**Regla permanente:**
Un DTO nuevo con `class-validator` en código post-migración es un bug de arquitectura.
Se bloquea en code review sin excepción.

## Referencias

- `checklists/backend-capa-2-rest-controllers.md` — checklist de migración completo
- `architecture/03-reglas-duras.md` — regla 🔴 "Cero DTOs nuevos con class-validator"
