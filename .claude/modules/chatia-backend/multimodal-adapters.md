# Adapters Multimodales — chatia-backend

## Principio de diseño

chatia-backend ya soporta todos los tipos de mensaje de WhatsApp en su
`channel.interface.ts`:

```typescript
type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location'
```

El flujo hoy convierte TODO a texto antes de entrar al LLM.
Los adapters multimodales son el puente entre el tipo de mensaje raw
y el texto que el LLM procesa.

**El LLM siempre recibe texto.** Los adapters normalizan la entrada.
La lógica de conversación, RAG y escalación no cambia.

---

## Stack completo — por puntaje de impacto

| Modalidad | Puntaje | Proveedor | Adapter a crear |
|---|---|---|---|
| Text-to-Text | 10/10 | Groq LLaMA | ✅ ya implementado |
| Speech-to-Text | 9/10 | Groq Whisper | `SpeechToTextAdapter` |
| Document-to-Text | 9/10 | FAQ ingest existente | `DocumentToTextAdapter` |
| Image-to-Text | 8/10 | Claude Vision | `ImageToTextAdapter` |
| Text-to-Speech | 7/10 | Cartesia | `TextToSpeechAdapter` |
| Location-to-Text | 7/10 | Geocoding (Google Maps / OSM) | `LocationToTextAdapter` |
| Speech-to-Speech | 6/10 | Groq Whisper + Groq LLaMA + Cartesia | stack encadenado |
| Video-to-Text | 4/10 | Gemini Flash | `VideoToTextAdapter` — Fase 2 |

---

## Interface de adapters multimodales

```typescript
// src/channels/adapters/multimodal.interface.ts
//
// Contrato que todos los adapters de entrada multimodal implementan.
// Recibe el mensaje raw del canal, devuelve texto para el LLM.
// El LLM siempre recibe texto — los adapters normalizan la entrada.

export interface IMultimodalAdapter {
  // Tipo de mensaje que este adapter maneja
  readonly supportedType: 'audio' | 'image' | 'video' | 'document' | 'location';

  // Convierte el contenido raw a texto para el LLM
  // mediaUrl: URL del archivo en el servidor del canal (WhatsApp CDN)
  // content:  texto adicional (caption, descripción)
  // raw:      payload completo del canal para casos edge
  toText(params: {
    mediaUrl?: string;
    content:   string;
    raw:       Record<string, unknown>;
  }): Promise<string>;
}
```

---

## Adapters — implementación

### SpeechToTextAdapter (audio → texto)

```
Proveedor: Groq Whisper
Por qué: ya tenés Groq integrado — misma API key, mismo circuit breaker
Costo: $0.04-0.11/hora de audio
Latencia: ~200ms para mensajes de WhatsApp (tipicamente < 60s)

Flujo:
  1. WhatsApp entrega mediaUrl del audio
  2. Descargar el audio del CDN de WhatsApp
  3. Enviar a Groq Whisper API
  4. Retornar transcripción como texto
  5. El texto entra al flujo normal del LLM

Fallback: si Groq Whisper falla → responder
  "No pude escuchar tu mensaje de voz. ¿Podés escribirlo?"
```

### DocumentToTextAdapter (PDF/doc → texto)

```
Proveedor: FAQ ingest existente (chatia-backend ya lo tiene)
Por qué: el módulo faq/ingestion ya extrae texto de PDFs
Costo: 0 — reutiliza código existente
Latencia: depende del tamaño del PDF

Flujo:
  1. WhatsApp entrega mediaUrl del documento
  2. Descargar el documento
  3. Reutilizar FaqIngestionService.extractText()
  4. Retornar texto extraído (truncado si muy largo)
  5. El texto entra al flujo normal del LLM

Fallback: si el documento no se puede leer →
  "Recibí tu documento pero no pude leerlo.
   ¿Es un PDF? ¿Podés describirme qué necesitás?"
```

### ImageToTextAdapter (imagen → texto)

```
Proveedor: Claude Vision (Anthropic API)
Por qué: mejor comprensión de imágenes en español, mejor en documentos
Costo: ~$0.003 por imagen (Claude Haiku Vision)
Latencia: ~500ms

Flujo:
  1. WhatsApp entrega mediaUrl de la imagen
  2. Descargar la imagen
  3. Enviar a Claude Vision con prompt de contexto de la org
  4. Retornar descripción como texto
  5. El texto entra al flujo normal del LLM

Prompt base (configurable por org):
  "Describí esta imagen en detalle. Si contiene texto, transcribilo.
   Si es un documento oficial, identificá el tipo de documento.
   Si muestra un problema (bache, desperfecto, etc), describí el problema."

Fallback: si Claude Vision falla → intentar GPT-4o Vision
  (CB pattern igual que providers de pagos)
```

### TextToSpeechAdapter (texto → audio)

```
Proveedor: Cartesia
Por qué: ~40ms tiempo al primer audio, voz clonada por org
Costo: competitivo para volumen de contact center

Cuándo se usa:
  - El mensaje entrante era de tipo 'audio' → responder con audio
  - La org tiene habilitado el canal de voz
  - El usuario explícitamente pide respuesta de voz

Config por organizationId:
  voiceId: string  — ID de voz en Cartesia (clonada o seleccionada)
  language: string — 'es' por defecto

Fallback: si Cartesia falla → responder en texto con nota
  "[Respuesta de texto — servicio de voz temporalmente no disponible]"
```

### LocationToTextAdapter (ubicación → texto)

```
Proveedor: OpenStreetMap Nominatim (gratuito) o Google Maps Geocoding
Por qué OSM primero: gratuito, sin API key, suficiente para municipios

Flujo:
  1. WhatsApp entrega lat/lng en el campo raw del mensaje
  2. Reverse geocoding → dirección legible
  3. Retornar texto: "Ubicación: Av. X 1234, Barrio Y, Ciudad Z"
  4. El texto entra al flujo normal del LLM

Ejemplo de output:
  "El ciudadano reporta desde: Av. San Martín 456, Barrio Centro.
   Coordenadas: -31.4167, -64.1833"

Fallback: si geocoding falla → usar coordenadas directamente
  "Ubicación recibida: lat -31.4167, lng -64.1833"
```

### VideoToTextAdapter (video → texto) — Fase 2

```
Proveedor: Gemini 2.0 Flash
Por qué: único que procesa video largo nativo, rápido y barato
Cuándo: Fase 2 — bajo volumen, mayor complejidad

Flujo:
  1. WhatsApp entrega mediaUrl del video
  2. Enviar a Gemini con prompt de descripción
  3. Retornar transcripción + descripción como texto

Fallback Fase 1: cuando llega un video →
  "Recibí tu video. Por ahora no puedo procesarlo.
   ¿Podés describirme qué muestra o mandarme una foto?"
```

---

## Estructura de carpetas en chatia-backend

```
src/channels/
  channel.interface.ts          ← BLOQUEANTE — no modificar sin ADR
  adapters/
    multimodal.interface.ts     ← interface de todos los adapters (NUEVA)
    speech-to-text.adapter.ts   ← Groq Whisper
    document-to-text.adapter.ts ← FAQ ingest reutilizado
    image-to-text.adapter.ts    ← Claude Vision
    text-to-speech.adapter.ts   ← Cartesia
    location-to-text.adapter.ts ← OSM Nominatim
    video-to-text.adapter.ts    ← Gemini Flash (Fase 2)
  multimodal.service.ts         ← orquesta los adapters según el tipo
  multimodal.module.ts
```

---

## MultimodalService — orquestador

```typescript
// src/channels/multimodal.service.ts
//
// Recibe un IncomingMessage del canal y normaliza su contenido a texto.
// Es el único punto donde se decide qué adapter usar.
// Los módulos de conversación no saben qué adapter corrió.

@Injectable()
export class MultimodalService {
  async normalize(msg: IncomingMessage, orgConfig: OrgMultimodalConfig): Promise<string> {
    switch (msg.type) {
      case 'text':     return msg.content;  // ya es texto
      case 'audio':    return this.stt.toText({ mediaUrl: msg.mediaUrl, content: msg.content, raw: msg.raw });
      case 'image':    return this.img.toText({ mediaUrl: msg.mediaUrl, content: msg.content, raw: msg.raw });
      case 'document': return this.doc.toText({ mediaUrl: msg.mediaUrl, content: msg.content, raw: msg.raw });
      case 'location': return this.loc.toText({ mediaUrl: msg.mediaUrl, content: msg.content, raw: msg.raw });
      case 'video':    return this.vid.toText({ mediaUrl: msg.mediaUrl, content: msg.content, raw: msg.raw });
      case 'sticker':  return '[El usuario envió un sticker]';
      default:         return msg.content || '[Mensaje no soportado]';
    }
  }
}
```

---

## Config de multimodal por organizationId

```typescript
// En la tabla Project o en un campo config de Organization
interface OrgMultimodalConfig {
  speechToText: {
    enabled:  boolean;
    provider: 'groq-whisper';  // único en v1
    language: string;           // 'es' default
  };
  textToSpeech: {
    enabled:  boolean;
    provider: 'cartesia';
    voiceId:  string;           // voz clonada de la org
  };
  imageToText: {
    enabled:  boolean;
    provider: 'claude-vision' | 'gpt4o-vision';
    prompt:   string;           // prompt base personalizable por org
  };
  locationToText: {
    enabled:  boolean;
    provider: 'osm' | 'google-maps';
  };
}
```

---

## Variables de entorno nuevas

```bash
# Groq Whisper — ya tiene GROQ_API_KEY, no necesita nueva key

# Cartesia TTS
CARTESIA_API_KEY=

# Claude Vision
ANTHROPIC_API_KEY=  # puede ser la misma que ya tenés en el proyecto

# Google Maps Geocoding (opcional — OSM es gratuito)
GOOGLE_MAPS_API_KEY=

# Gemini (Fase 2)
GOOGLE_AI_API_KEY=
```

---

## Orden de implementación

```
Sprint 1 — Mayor impacto, menor esfuerzo
  1. SpeechToTextAdapter    (Groq Whisper — mismo proveedor)
  2. DocumentToTextAdapter  (reutiliza FAQ ingest — casi gratis)

Sprint 2 — Completa el canal de imagen
  3. ImageToTextAdapter     (Claude Vision adapter nuevo)
  4. LocationToTextAdapter  (OSM — gratuito, sin key)

Sprint 3 — Canal de voz completo
  5. TextToSpeechAdapter    (Cartesia — nueva integración)
  6. MultimodalService      (orquestador de todos)

Sprint 4 — Fase 2
  7. VideoToTextAdapter     (Gemini Flash)
```

---

## Invariantes

1. **El LLM siempre recibe texto** — ningún adapter pasa media directamente al LLM
2. **Circuit breaker obligatorio** en ImageToTextAdapter y TextToSpeechAdapter
3. **Fallback explícito** en cada adapter — nunca silencio, siempre respuesta al usuario
4. **Config por `organizationId`** — cada org habilita/deshabilita y configura su stack
5. **El canal de WhatsApp responde en el mismo tipo** — si entró voz, responde voz (cuando TTS está habilitado)
6. **mediaUrl expira** — los archivos de WhatsApp CDN expiran en 5 min, descargar inmediatamente

---

## Referencia

- `src/channels/channel.interface.ts` — BLOQUEANTE, ya soporta todos los tipos
- `src/faq/ingestion/` — reutilizar para DocumentToTextAdapter
- `src/groq/groq.service.ts` — extender para Whisper endpoint
- `.claude/decisions/ADR-005-circuit-breaker-opossum.md` — CB pattern
