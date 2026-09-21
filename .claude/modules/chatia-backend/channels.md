# Módulo: channels (Canales de comunicación)

## ¿Qué hace?

Define el patrón Strategy para canales de comunicación (WhatsApp, Email, etc.).

## Interface BLOQUEANTE

`channel.interface.ts` — es el contrato que todo adapter de canal debe implementar.
**No modificar sin ADR.** Cambiarla rompe todos los adapters existentes y futuros.

## Cómo agregar un nuevo canal

1. Crear carpeta `src/channels/<nombre-canal>/`
2. Implementar la interface `IChannel`
3. Registrar en `channel.module.ts`
4. **No modificar la interface** — si el nuevo canal necesita algo que la interface
   no tiene, abrir ADR para extenderla de forma backward-compatible.

## Canales implementados

Verificar en `src/channels/` — documentar aquí cuando se conozcan.

---

## Tipos de mensaje soportados por la interface

La `IncomingMessage.type` ya soporta todos los tipos de WhatsApp:

```typescript
type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location'
```

El procesamiento de cada tipo no-texto lo resuelve `MultimodalService`
via adapters especializados. Ver `.claude/modules/chatia-backend/multimodal-adapters.md`.

**Regla:** ningún controller o service de conversación procesa media directamente.
Todo pasa por `MultimodalService.normalize()` → texto → LLM.
