---
name: provider-adapter
description: Integrar un proveedor externo (LLM, voz a texto, texto a voz, visión, embeddings, geolocalización, pago, email/WhatsApp) detrás de un adapter con circuit breaker, cadena de fallback y degradación elegante. Usar cuando el usuario pida "agregar un proveedor", "fallback para X", "integrar Y", "cambiar de proveedor" o se toque infrastructure/providers, adapters de pagos o notificaciones.
---

# provider-adapter

Base: `architecture/04-degradacion-elegante.md`, `infrastructure/providers-fallback.md` (matriz de proveedores y fallbacks),
`checklists/circuit-breaker-adapters.md` (parcialmente histórico: chatia ya usa cadena de proveedores), `checklists/nuevo-provider-pago.md` (pagos).

## Principio rector
> **La falla de un proveedor NUNCA escala a un humano.** El handoff ocurre solo por voluntad del humano o pedido explícito del usuario.

Orden de degradación: **1)** reintento con backoff → **2)** proveedor alternativo (cadena por prioridad) → **3)** degradar capacidad
(voz→texto, imagen→descripción) → **4)** mensaje claro al usuario para que reintente (nunca disfrazado de handoff) + **alerta técnica** (no a los agentes).
`assistant:escalate` no se emite desde ningún path de error de proveedor.

## Procedimiento
1. **Ubicar**: el adapter y su cliente van en `infrastructure/` (`providers/`, `channels/adapters/`, o el módulo de pagos/notificaciones del servicio).
   `core/` solo conoce una **interface** (puerto). No exponer tipos del SDK fuera del adapter.
2. **Reutilizar** lo que existe en chatia: `OpenAiCompatClient` (cualquier API compatible con OpenAI), `ProviderChainService` (cadena con fallback y métricas),
   `provider-order.ts` (orden configurable por env: `LLM_PROVIDERS`, `STT_PROVIDERS`, …), `CircuitBreakerService` (opossum).
   Si el proveedor habla el protocolo de OpenAI, **solo agregar su configuración** a la cadena.
3. **Circuit breaker** por proveedor, con clave propia, `timeout`, `errorThreshold`, `resetTimeout`.
   **`CircuitOpenError` siempre capturado** en los paths que llaman a proveedores externos (regla dura: PR bloqueado si no).
4. **Credenciales**: solo por `ConfigService`/env, agregadas a `.env.example`, al esquema de validación si son obligatorias, y a `docs` del servicio. Nunca hardcodeadas ni en logs/URLs.
5. **Observabilidad**: contar intentos, fallos y agotamiento de cadena (`provider_chain_exhausted_total`); el log `[ALERTA TÉCNICA]` es el gancho de alertas.
6. **Seguridad**: webhooks del proveedor con **firma verificada antes de procesar**; no persistir PII, solo tokens del proveedor; descargas de URLs externas con protección SSRF.
7. **Probar con claves reales** antes de darlo por bueno (ids de modelo, JSON mode, latencia vs timeout, español, formatos de audio). Hasta entonces anotarlo como **no verificado**.

## Tests
- Adapter con SDK/`fetch` mockeado: éxito, error HTTP, timeout.
- Cadena: el primero falla → usa el segundo; todos fallan → degrada y **no** emite escalación.
- Circuit breaker abierto → respuesta degradada, sin lanzar.
- Firma de webhook: válida e inválida.
- Un **fake adapter** con el mismo contrato para tests de otros módulos.

## Documentación
- Actualizar `infrastructure/providers-fallback.md` (columna "¿Tiene fallback?") y las variables en `services/<svc>.md`.
- Costos, límites y versión de la API del proveedor (p. ej. Graph API v19.0 → revisar deprecación).
