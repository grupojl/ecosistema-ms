# Manzana — Dominio y comportamiento esperado

> Última actualización: 2026-10-02
> Referencia de código: `chatia-backend/src/modules/manzana/`
> Estado: 🔲 En desarrollo — comportamiento pendiente de definir con el equipo de producto

---

## Qué es Manzana

> ⚠️ TODO: completar con el equipo de producto antes del primer deploy de Manzana.
> Lo que está abajo es un placeholder basado en lo que se ve en el código.

Ecosistema en desarrollo. La estrategia actual (`ManzanaStrategy`) es un
placeholder con system prompt genérico y sin comportamiento diferenciado.

---

## Estado actual del código

```typescript
// manzana.strategy.ts — estado real hoy
systemPrompt: "Eres un asistente de MANZANA. TODO: completar con instrucciones específicas."
```

Esto significa que hoy Manzana usa el mismo comportamiento que el fallback
genérico. No hay diferenciación real respecto a otros ecosistemas.

---

## Lo que hay que definir antes de activar Manzana en producción

- [ ] Qué tipo de negocio es Manzana (ecommerce, servicios, SaaS, otro)
- [ ] Quién es el usuario final y qué canal usa
- [ ] Qué tono debe tener el bot
- [ ] Cuándo escalar a humano
- [ ] Qué proveedores de pago están habilitados
- [ ] Si tiene Knowledge Base propia o usa la de la org
- [ ] KPIs que importan para este ecosistema
- [ ] Si necesita stages de conversación distintos a Welver

---

## Flujo de conversación

> Pendiente de definición. Usar el flujo de Welver como referencia hasta
> que se especifique el comportamiento propio de Manzana.

---

## Reglas de negocio

> Pendiente. Completar este archivo antes de implementar comportamiento
> en `ManzanaStrategy.enrichConversationContext()`.

---

## Invariantes

> Pendiente. Como mínimo aplican las mismas invariantes que Welver
> (multi-tenancy, idempotencia de pagos, opt-out de notificaciones).

---

## Notas de implementación

- `ManzanaStrategy` se auto-registra en `onModuleInit()` con `ProjectType.MANZANA`
- Agregar comportamiento real = editar `manzana.strategy.ts` + actualizar este archivo
- El fallback en caso de error devuelve system prompt genérico — aceptable hasta
  que se defina el comportamiento real

