# Mexus — Dominio y comportamiento esperado

> Última actualización: 2026-10-02
> Referencia de código: `chatia-backend/src/modules/mexus/`
> Estado: 🔲 En desarrollo — comportamiento pendiente de definir con el equipo de producto

---

## Qué es Mexus

> ⚠️ TODO: completar con el equipo de producto antes del primer deploy de Mexus.
> Lo que está abajo es un placeholder basado en lo que se ve en el código.

Ecosistema en desarrollo. La estrategia actual (`MexusStrategy`) es un
placeholder con system prompt genérico y sin comportamiento diferenciado.

---

## Estado actual del código

```typescript
// mexus.strategy.ts — estado real hoy
systemPrompt: "Eres un asistente de MEXUS. TODO: completar con instrucciones específicas."
```

Esto significa que hoy Mexus usa el mismo comportamiento que el fallback
genérico. No hay diferenciación real respecto a otros ecosistemas.

---

## Lo que hay que definir antes de activar Mexus en producción

- [ ] Qué tipo de negocio es Mexus (ecommerce, servicios, SaaS, otro)
- [ ] Mercados geográficos objetivo (México, LATAM, global)
- [ ] Quién es el usuario final y qué canal usa
- [ ] Qué tono debe tener el bot
- [ ] Cuándo escalar a humano
- [ ] Qué proveedores de pago están habilitados (contexto Mexico: Conekta?)
- [ ] Si tiene Knowledge Base propia o usa la de la org
- [ ] KPIs que importan para este ecosistema
- [ ] Si necesita stages de conversación distintos a Welver

---

## Flujo de conversación

> Pendiente de definición. Usar el flujo de Welver como referencia hasta
> que se especifique el comportamiento propio de Mexus.

---

## Reglas de negocio

> Pendiente. Completar este archivo antes de implementar comportamiento
> en `MexusStrategy.enrichConversationContext()`.

---

## Invariantes

> Pendiente. Como mínimo aplican las mismas invariantes que Welver
> (multi-tenancy, idempotencia de pagos, opt-out de notificaciones).

---

## Notas de implementación

- `MexusStrategy` se auto-registra en `onModuleInit()` con `ProjectType.MEXUS`
- Agregar comportamiento real = editar `mexus.strategy.ts` + actualizar este archivo
- El fallback en caso de error devuelve system prompt genérico — aceptable hasta
  que se defina el comportamiento real
- Mexus tiene contexto de mercado (`X-Market-Country`) — considerar MXN como
  moneda default y Conekta como proveedor de pago preferido para México

