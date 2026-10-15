# Matriz de proveedores y fallbacks por microservicio

> Última actualización: 2026-10-13 (relevado del código, no de docs previas)
> Complementa `providers.md` (detalle y variables de entorno) y `architecture/04-degradacion-elegante.md` (patrones).

**Columnas**
- **¿Tiene fallback?**: ✅ sí, funciona · ⚠️ parcial o incorrecto · ❌ no tiene
- **¿Hace falta?**: **SÍ** = conviene un proveedor alternativo para que el servicio sea sólido · **NO** = no hace falta (no existe alternativa real, o la degradación actual alcanza; se explica en *Fallback planeado*)
- **Fallback planeado**: lo que vamos a integrar. 🟢 definido · 🟡 a probar antes de integrar · 🔲 sin decidir

---

## Principio: la falla de un proveedor NUNCA escala a un humano

La intervención humana ocurre **solo por voluntad del humano** (un agente toma la conversación y corta la charla con la IA) o por pedido explícito del usuario. Una caída de proveedor es un problema de infraestructura y se resuelve con infraestructura:

1. Reintento con backoff.
2. Proveedor alternativo (cadena de fallback por prioridad).
3. Degradación de capacidad (ej. voz → texto, imagen → caption).
4. Último recurso: mensaje al usuario indicando que reintente (nunca disfrazado de handoff) + alerta al equipo técnico, no a los agentes de atención.

Los eventos `assistant:escalate` no deben emitirse desde ningún path de error de proveedor.

---

## chatia-backend

| Capacidad | Provider | Circuit breaker | ¿Tiene fallback? | ¿Hace falta? | Fallback planeado | Detalle |
|-----------|----------|-----------------|------------------|--------------|-------------------|---------|
| Chat LLM | Groq `openai/gpt-oss-120b` | ✅ `groq-llm` | ⚠️ **incorrecto** | **SÍ** | 🟡 **SiliconFlow `gpt-oss-120b`** → si toda la cadena cae: mensaje de reintento + alerta técnica | Hoy escala a humano al abrirse el CB (`assistant-chat.service.ts:134-137`). Claude descartado por costo. Alternativa si bloquea la privacidad: mismo modelo en otro host fuera de China |
| Clasificación / intent | Groq `gpt-oss-20b` | ✅ mismo CB | ⚠️ igual que chat | **SÍ** | 🟡 **SiliconFlow `gpt-oss-120b`** (no confirmé que tenga el 20b) → último recurso: reglas simples | Mismo router de LLM |
| Speech-to-text | Groq Whisper | ✅ `groq-whisper-stt` | ✅ pide al usuario que escriba | **SÍ** | 🟡 **SiliconFlow audio/transcriptions** → si falla: pedir texto (ya existe) | Hoy comparte proveedor con el chat: si Groq cae, caen los dos. Modelos y calidad en español sin confirmar |
| Image-to-text | Hoy: Anthropic `claude-haiku-4-5`. **Planeado: Groq Llama 4 Scout** (reemplaza a Haiku por costo) | ✅ `claude-vision-image` (renombrar al migrar) | ✅ usa caption / mensaje genérico | **SÍ** | 🟡 **SiliconFlow Qwen3-VL-32B-Instruct** → si falla: caption / mensaje genérico (ya existe) | Precios aprox. (agregadores): Haiku $1/$5, Scout $0.11/$0.34, Qwen3-VL-32B $0.20/$0.60 por M tokens. Confirmar que Scout acepta imágenes en la doc de Groq. Probar con 20-30 imágenes reales (DNI, facturas, capturas) antes de migrar. Con esto chat, STT e imagen dependen de Groq a la vez |
| Text-to-speech | Cartesia (~$49/M caracteres, voz clonada por org) | ✅ `cartesia-tts` | ✅ responde en texto (hay `catch`) | **SÍ** | 🟢 **ElevenLabs Flash** (~$50/M caracteres, mismo precio; única alternativa que mantiene voz clonada por org) → si falla: responder en texto (ya existe) | Requiere `ELEVENLABS_API_KEY` y clonar/mapear la voz de cada org. Pedir salida opus en ogg (formato actual del adapter para WhatsApp) o convertir con ffmpeg. Precios de blogs comparativos, verificar. Descartados: Groq (solo inglés/árabe), SiliconFlow CosyVoice2 (enfocado en chino/inglés, español sin confirmar) |
| Location-to-text | Nominatim (OSM, API pública) | ❌ | ⚠️ solo coordenadas (el LLM no puede interpretarlas) | **SÍ** | 🟡 **LocationIQ** (API casi idéntica a Nominatim) precedido por caché en Redis → si fallan: coordenadas. Ver sección "Plan location-to-text" | Nominatim público: máx. ~1 pedido/s y puede bloquear. El adapter hoy no cachea, no limita ritmo, tiene User-Agent genérico y no tiene CB |
| Video-to-text | stub (hoy responde "no puedo procesar videos"). **Planeado: Gemini 2.5 Flash-Lite** (~$0.10/M tokens entrada, $0.40/M salida; una sola llamada que entiende imagen y audio) | ❌ (por crear) | ✅ mensaje amigable (el stub actual) | **SÍ** | 🟡 **SiliconFlow Qwen3-VL** (~$0.13–0.20/M entrada, $0.60–1.60/M salida; acepta video) → si falla: mensaje amigable ("describime qué muestra"). Alternativa sin proveedor nuevo: ffmpeg + Groq Scout (fotogramas) + Groq Whisper (audio) | Gemini requiere clave nueva. De memoria el video consume ~260 tokens/s (<1 centavo/min): verificar en la doc de Google. Confirmar que SiliconFlow admite video. Precios de agregadores que se contradicen. Procesar como job BullMQ con tope de duración/tamaño (WhatsApp: 16 MB). Verificar que el plan pago de Google no use los datos para entrenar |
| Speech-to-speech (notas de voz) | Encadenado: Groq Whisper → LLM → Cartesia (`multimodal-adapters.md`) | ✅ hereda los CB de cada etapa | ✅ hereda: audio → texto, respuesta → texto | **SÍ** | 🟢 Hereda los fallbacks de STT (SiliconFlow), chat (SiliconFlow) y TTS (ElevenLabs). No necesita proveedor propio | Tres etapas en serie: la latencia y la falla se acumulan |
| Speech-to-speech (llamadas en tiempo real) | Ninguno: no implementado. **Planeado: pipeline propio en streaming** (voz a texto streaming → LLM → texto a voz) | — | — | **SÍ** (cuando se implemente) | 🟡 **Texto a voz: Cartesia → ElevenLabs Flash** (misma cadena que TTS). **LLM: Groq → SiliconFlow** (misma cadena que chat). 🔲 **Voz a texto en streaming: sin decidir** (Groq Whisper procesa por lotes, no sirve; candidatos: Deepgram, ElevenLabs Scribe a verificar). Canal: WhatsApp Business Calling (llamadas iniciadas por el usuario gratis; requiere proveedor de VoIP por WebRTC/SIP). Si todo falla: cortar con mensaje pregrabado y seguir por WhatsApp en texto | Cada etapa tiene su propio fallback; reutiliza las cadenas existentes. Requiere un orquestador en tiempo real (LiveKit Agents o Pipecat; verificar que soporte fallback por etapa). Latencia objetivo <1 s sumando tres etapas. Costo estimado de referencia: ~$0.03 por minuto de llamada con Cartesia (~$0.13–0.19 por llamada de 5 min), contra ~$0.10–0.18/min de ElevenLabs Agents administrado; precios de blogs, verificar. La alternativa administrada (ElevenLabs Agents) sale más rápido pero no tiene fallback propio: es punto único de falla. Una caída en plena llamada no puede escalar a humano (ver principio). Requiere ADR |
| Embeddings (consulta FAQ/RAG) | **No son embeddings reales.** `EmbeddingService` (`chatia-backend/src/infrastructure/common/services/embedding.service.ts`) le pide a Groq `gpt-oss-20b` (chat) que "genere" 384 números y los parsea. Los vectores se guardan como `Json` en `KbChunk.embedding` (sin pgvector) | ❌ | ❌ **peor: falla en silencio** (el `catch` devuelve un vector de ceros, similitud 0, sin alerta) | **SÍ** | 🟡 **Reemplazar por un modelo de embeddings real y multilingüe: `BAAI/bge-m3` vía SiliconFlow** (también existe `multilingual-e5`; verificar precio y que cubra español). Guardar en **pgvector**. Fallback real = **búsqueda por texto** (Postgres full-text), porque los vectores de modelos distintos no son comparables. Si más adelante se quiere un fallback vectorial: segundo índice en paralelo con otro modelo | Los vectores actuales son inventados por un LLM de chat: no son estables ni semánticos, así que **reindexar no pierde nada**. Hacerlo ahora, antes de tener contenido real. Registrar en cada fila qué modelo y versión generó el vector (para migrar sin reindexar a ciegas). Lanzar error en vez de devolver ceros y agregar CB. Cambiar de modelo siempre obliga a reindexar todo. `bge-m3` se puede autoalojar después sin cambiar de modelo (no reindexa). El comentario de la línea 9 ("Sprint 4: pgvector") ya anticipaba el cambio |
| WhatsApp / Instagram / Messenger | Meta Graph API v19.0 (versión de comienzos de 2024: revisar si está deprecada y pasarla a variable de configuración) | ❌ | ❌ | **SÍ** (canal alternativo, no proveedor alternativo) | 🟡 **Canal alternativo de entrada: widget web** (ya existe `widget.controller.ts`; colocarlo en el sitio del municipio) + cola persistente con reintentos e idempotencia en salida + recuperación de webhooks perdidos en entrada + monitoreo de la cuenta | No hay otro proveedor para el mismo canal. El riesgo real no es una caída de Meta sino perder o degradar la cuenta (bloqueo del número, baja de calidad por reclamos, límite de mensajes): un municipio con un solo número tiene un punto único de falla. Monitorear calificación de calidad y límites de mensajería, y alertar al equipo técnico |
| TikTok (mensajes) | TikTok API | ❌ | ❌ | NO | 🟢 **Fuera del alcance inicial**: no es prioridad para atención municipal informativa; no invertir en resiliencia ni mantenimiento hasta que haya demanda | API de mensajes limitada |

## workers-backend

| Capacidad | Provider | Circuit breaker | ¿Tiene fallback? | ¿Hace falta? | Fallback planeado | Detalle |
|-----------|----------|-----------------|------------------|--------------|-------------------|---------|
| Embeddings (`faq-ingest`, `vector-index`) | Groq embeddings | ✅ | ⚠️ solo BullMQ retry + DLQ | **SÍ** | 🟡 Retry + DLQ hoy (se mantiene: si el CB abre, el job espera y reintenta). **Debe indexar con el mismo modelo que use chatia para consultar** (`bge-m3`, ver fila de chatia-backend). Sin proveedor alternativo de indexado: un segundo modelo exigiría un segundo índice | Los vectores de consulta e indexado deben estar en el mismo espacio. **Hoy no lo están:** workers llama al endpoint `/embeddings` de Groq con `nomic-embed-text-v1_5` (`workers-backend/.../embedding.service.ts`), mientras chatia genera 384 números con un LLM de chat. Verificar con una llamada real que Groq ofrezca ese endpoint (si da 404, los jobs fallan siempre) y confirmar en `faq-ingestion.service.ts` qué servicio indexa lo que chatia consulta. Solución: **un solo servicio de embeddings** (paquete compartido o gRPC) usado por ambos |

## notificaciones-backend

| Capacidad | Provider | Circuit breaker | ¿Tiene fallback? | ¿Hace falta? | Fallback planeado | Detalle |
|-----------|----------|-----------------|------------------|--------------|-------------------|---------|
| Email | Resend | ✅ `CBService` | ⚠️ solo retry + DLQ | **SÍ** | 🔲 **Sin decidir.** Candidatos: SendGrid o Amazon SES (`IEmailProvider`) | Si Resend cae un buen rato no sale ningún email |
| WhatsApp | Meta Graph API | ✅ `CBService` | ⚠️ solo retry + DLQ | NO | 🟢 Degradar a email o push (sin proveedor alternativo) | Meta es el único proveedor posible |
| Push | Firebase Cloud Messaging | ❌ | ❌ | NO | 🟢 Ninguno (se aceptan pérdidas) | No hay alternativa práctica |

## pasarelapagos-backend

| Capacidad | Provider | Circuit breaker | ¿Tiene fallback? | ¿Hace falta? | Fallback planeado | Detalle |
|-----------|----------|-----------------|------------------|--------------|-------------------|---------|
| Pagos | MercadoPago, Stripe, dLocal, Conekta, PagarMe | ✅ por proveedor | ✅ `routing.service.ts` elige otro según país/moneda/método | **SÍ** | 🟢 Ya implementado (routing entre proveedores) | Es la referencia de diseño (ADR-002) |

## marketing-backend

| Capacidad | Provider | Circuit breaker | ¿Tiene fallback? | ¿Hace falta? | Fallback planeado | Detalle |
|-----------|----------|-----------------|------------------|--------------|-------------------|---------|
| Meta Ads | Meta Graph API v19.0 | ❌ | ❌ | NO | 🟢 Retry + DLQ + alerta | API de plataforma, no intercambiable |
| Google Ads | Google Ads API | ❌ | ❌ | NO | 🟢 Retry + DLQ + alerta | Igual |
| TikTok Ads | TikTok API | ❌ | ❌ | NO | 🟢 Retry + DLQ + alerta | Igual |

## analytics-backend

Sin proveedores externos propios (solo Postgres y Redis).

## Transversales (todos los servicios)

| Capacidad | Provider | Circuit breaker | ¿Tiene fallback? | ¿Hace falta? | Fallback planeado | Detalle |
|-----------|----------|-----------------|------------------|--------------|-------------------|---------|
| Autenticación | Firebase Auth | ❌ | ❌ | **SÍ** | 🔲 **Sin decidir.** Opciones: JWT propio / Auth0 / magic link (`IAuthProvider`, ver `providers.md`) | Si cae, cae el login de todo el ecosistema |
| Base de datos | PostgreSQL (una por servicio) | — | ❌ sin réplica ni backups | **SÍ** | 🔲 Backups automáticos + réplica de lectura (Hetzner/AWS) | Backups pendientes |
| Cola / caché | Redis | — | ❌ | **SÍ** | 🔲 Habilitar AOF | Sin AOF, BullMQ pierde jobs en vuelo |

---

## Candidato de fallback: SiliconFlow (💡 sin decidir, requiere ADR)

**Puntaje como fallback de chat LLM: 6.5/10** (8.5 si no existiera el riesgo de privacidad). Claude Haiku se descartó porque en una caída larga de Groq el costo sube mucho.

**A favor**
- Hospeda `gpt-oss-120b`, el mismo modelo que Groq: casi no cambian prompts, estilo ni salida JSON.
- Infraestructura independiente de Groq.
- API compatible con OpenAI: `GroqService` se adapta cambiando URL y key.
- Precio reportado por un agregador (no oficial): ~$0.09/M entrada y $0.45/M salida. Verificar contra la página oficial y contra el precio actual de Groq.

**En contra**
- Una reseña (fuente única, a confirmar en sus términos) dice que la inferencia corre en infraestructura china, exige verificación de identidad real desde mayo 2026 y no tiene documentación SOC2/GDPR. Las conversaciones llevan datos personales de clientes de LATAM.
- Sin datos de uptime, límites de uso ni SLA.
- Latencia sin medir. Groq es muy rápido; SiliconFlow probablemente más lento. Medir contra el timeout de 15s del CB.

**Cobertura en chatia-backend** (según su documentación; la calidad en español NO está verificada)

| Capacidad de chatia | Hoy | ¿SiliconFlow la cubre? | Notas |
|---------------------|-----|------------------------|-------|
| Chat LLM | Groq gpt-oss-120b | ✅ | Mismo modelo, endpoint OpenAI |
| Clasificación / intent | Groq gpt-oss-20b | ✅ probable | No confirmé el 20b; se puede usar el 120b |
| JSON mode (`chatJson`) | `response_format: json_object` | ✅ hay guía | Probar con gpt-oss-120b |
| Speech-to-text | Groq Whisper | ✅ endpoint de transcripciones | Modelos y calidad en español sin confirmar. Hoy comparte proveedor con el chat |
| Image-to-text | Groq Llama 4 Scout (hoy: Claude Haiku) | ✅ Qwen3-VL-32B-Instruct ($0.20/$0.60) | GLM-4.6V descartado: varias páginas lo marcan deprecado. Algunas páginas de SiliconFlow dicen "image input: not supported", probablemente error de su doc; probar con una imagen real |
| Text-to-speech | Cartesia | ❌ descartado | CosyVoice2 enfocado en chino/inglés; el fallback de voz es ElevenLabs |
| Video-to-text | Gemini 2.5 Flash-Lite (planeado) | ⚠️ Qwen3-VL acepta video | Confirmar que SiliconFlow lo admite y a qué precio |
| Embeddings (RAG) | Groq embeddings | ✅ más rerank | Cambiar de modelo obliga a reindexar |
| Location (geocoding) | Nominatim | ❌ no es IA | Ver "Plan location-to-text": se resuelve con LocationIQ (compatible con Nominatim) |
| Canales | Meta, TikTok | ❌ no aplica | No son capacidades de IA |

**Condiciones antes de adoptarlo**
1. Revisar términos de uso y política de retención de datos.
2. Probar JSON mode, latencia y calidad en español con gpt-oss-120b.
3. Enviar el mínimo de datos personales posible (redactar PII cuando se pueda).
4. Alternativa si la privacidad bloquea: mismo modelo en un host fuera de China (Together, Fireworks, DeepInfra, Cerebras, OpenRouter). Precios y uptime sin verificar.

**Prioridad de uso:** (1) chat e intent, (2) speech-to-text, para no depender de Groq en ambos, (3) imagen (Qwen3-VL-32B), (4) embeddings solo si se acepta reindexar. La voz (TTS) va con ElevenLabs, no con SiliconFlow.

---

## Plan location-to-text (costo y eficiencia)

**Principio:** no geocodificar si no hace falta. Cada pedido evitado cuesta cero y es instantáneo.

**Cadena (de más barato a más caro)**
1. Datos de WhatsApp (`name` / `address`): ya existe, sin pedido externo.
2. Caché Redis: clave `geo:{lat a 4 decimales}:{lng a 4 decimales}` (~10 m), TTL 30 días. Las fallas se cachean unos minutos.
3. Nominatim público, gratis, con límite de 1 pedido/s.
4. LocationIQ (plan gratuito, con `LOCATIONIQ_API_KEY`).
5. Coordenadas (degradado actual).

**Diseño**
- `GeocodingService` en `infrastructure/geocoding/` con interfaz `IGeocodingProvider` (`NominatimProvider`, `LocationIqProvider`); el adapter solo lo llama.
- `ProviderChain<T>` genérico y reutilizable (circuit breaker por proveedor, orden configurable). Se reutiliza para LLM, STT, imagen y email.
- Orden por env: `GEOCODING_PROVIDERS=nominatim,locationiq`. Si el volumen crece, se invierte sin tocar código.
- Límite de ritmo en Redis (no en memoria) para que valga con varias réplicas.
- Un solo pedido en vuelo por coordenada (single-flight).
- Texto corto para el LLM (`calle altura, barrio, ciudad, provincia`) en lugar de `display_name`, que trae país, código postal, etc. Menos tokens.
- User-Agent identificable con contacto (política de Nominatim).
- Métricas Prometheus: aciertos de caché, proveedor usado, errores.

**Orden de trabajo**

| Paso | Qué | Esfuerzo | Costo |
|------|-----|----------|-------|
| 1 | Caché + redondeo + texto corto + User-Agent + límite de ritmo | bajo | $0 |
| 2 | Circuit breaker y métricas | bajo | $0 |
| 3 | LocationIQ como segundo proveedor | bajo | $0 (plan gratuito, verificar límites) |
| 4 | `ProviderChain` genérico | medio | $0 |

**Pendiente de decidir:** qué proveedor va primero (Nominatim con poco volumen; LocationIQ si crece) y si `ProviderChain` se hace ya genérico (recomendado).

**Privacidad:** las coordenadas de un cliente van a un tercero; baja sensibilidad, pero conviene mencionarlo en los términos.

---

## Resumen: lo que hay que resolver (hace falta y no está bien)

| Prioridad | Qué | Fallback planeado | Estado |
|-----------|-----|-------------------|--------|
| 1 | Chat LLM / intent: corregir escalado a humano + LLM secundario | 🟡 SiliconFlow gpt-oss-120b | ⚠️ incorrecto |
| 2 | Embeddings de consulta en chatia: CB + secundario | 🔲 sin decidir | ❌ |
| 3 | Email: segundo proveedor | 🔲 SendGrid / SES | ⚠️ |
| 4 | Auth: fallback de Firebase | 🔲 sin decidir | ❌ |
| 5 | Postgres backups / Redis AOF | 🔲 sin decidir | ❌ |

## Discrepancias detectadas entre docs y código

1. `providers.md` dice **SendGrid** para email; el código usa **Resend**.
2. `providers.md` dice modelo default `llama-3.3-70b-versatile`; el código usa `openai/gpt-oss-120b` (hay migración `groq_default_model`).
3. No documentados en `providers.md`: **Anthropic (Vision)**, **Cartesia (TTS)**, **Nominatim**, **Groq Whisper**, **Groq embeddings**.
4. `04-degradacion-elegante.md` listaba el fallback de LLM como pendiente, pero `GroqCbService` ya existe y `assistant-chat.service.ts` captura `CircuitOpenError` (aunque escala a humano, lo cual es incorrecto).

## Patrón recomendado para fallback entre proveedores

```
ILlmProvider { chat(messages, opts): Promise<LlmResponse> }
 ├─ GroqLlmAdapter          (CB 'groq-llm')            primario
 └─ SiliconFlowLlmAdapter   (CB 'siliconflow-llm')     fallback (misma API OpenAI, mismo modelo)
LlmRouter: intenta en orden de prioridad; salta al siguiente ante CircuitOpenError o error;
           si todos fallan → mensaje de reintento (sin escalar a humano) + alerta técnica.
```

Mismo diseño que `routing.service.ts` de pagos. Aplicable a email (`IEmailProvider`).

## Pendientes

- [ ] Quitar el escalado a humano en `assistant-chat.service.ts` y corregir el mensaje por defecto.
- [ ] ADR: SiliconFlow como LLM secundario y política de routing (costo, calidad en español, privacidad).
- [ ] Probar SiliconFlow: JSON mode, latencia vs timeout 15s, calidad en español, speech-to-text.
- [ ] Image-to-text: confirmar soporte de imágenes de Groq Llama 4 Scout y de SiliconFlow Qwen3-VL-32B; comparar contra Haiku con imágenes reales antes de migrar `image-to-text.adapter.ts`.
- [ ] Revisar términos y retención de datos de SiliconFlow (o elegir host alternativo fuera de China).
- [ ] Verificar precios oficiales de SiliconFlow y Groq.
- [ ] Location-to-text: caché Redis, límite de ritmo, User-Agent con contacto, CB, texto corto (pasos 1-2 del plan).
- [ ] Location-to-text: integrar LocationIQ y verificar límites de su plan gratuito.
- [ ] Decidir `ProviderChain` genérico (reutilizable en LLM, STT, imagen, email).
- [ ] TTS: integrar ElevenLabs Flash como fallback de Cartesia (clave, voces por org, formato opus/ogg, verificar precio).
- [ ] Video-to-text: implementar con Gemini 2.5 Flash-Lite; verificar tokens/s de video y política de datos; confirmar video en SiliconFlow Qwen3-VL; definir tope de duración/tamaño y job BullMQ.
- [ ] Speech-to-speech en llamadas: pipeline propio (Cartesia → ElevenLabs en TTS; Groq → SiliconFlow en LLM). Pendiente: elegir voz a texto en streaming y su fallback, elegir orquestador (LiveKit Agents / Pipecat), definir puente con WhatsApp Business Calling (WebRTC/SIP) y escribir ADR antes de implementar.
- [ ] Canales Meta: verificar si Graph v19.0 sigue soportada y moverla a variable de configuración.
- [ ] Canales Meta: monitoreo de calificación de calidad y límites de mensajería por número; alerta técnica.
- [ ] Canales Meta: cola persistente de salida con idempotencia y recuperación de webhooks perdidos en entrada.
- [ ] Canal alternativo: ofrecer el widget web de `chatia-backend` en el sitio de cada municipio.
- [ ] ADR: proveedor de email secundario.
- [ ] Embeddings: reemplazar el "embedding por chat" de `EmbeddingService` por un modelo real (`bge-m3` vía SiliconFlow; verificar precio y español), migrar `FaqChunk.embedding` a pgvector, guardar modelo/versión por fila y reindexar.
- [ ] Embeddings: unificar en un solo servicio para chatia y workers (hoy hay dos copias con métodos distintos); probar el endpoint `/embeddings` de Groq y confirmar quién indexa en `faq-ingestion.service.ts`.
- [ ] Embeddings: dejar de devolver vector de ceros en el `catch`; lanzar error, agregar CB y degradar a búsqueda por texto (Postgres full-text).
- [ ] ADR: estrategia de embeddings secundarios (solo si hace falta un fallback vectorial; implica un segundo índice).
- [ ] Corregir `providers.md` con las discrepancias de arriba.
