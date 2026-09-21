// chatia-backend/src/channels/adapters/speech-to-text.adapter.ts
//
// Proveedor: Groq Whisper
// Por qué: ya tenés Groq integrado — misma API key, mismo circuit breaker
// Costo: $0.04-0.11/hora de audio
// Latencia: ~200ms para mensajes de WhatsApp (tipicamente < 60s)
//
// Fallback: si Groq Whisper falla → mensaje de texto al usuario
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service.js';
import type { IMultimodalAdapter, MultimodalInput } from './multimodal.interface.js';

const WHISPER_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL   = 'whisper-large-v3';
const CB_KEY          = 'groq-whisper-stt';

@Injectable()
export class SpeechToTextAdapter implements IMultimodalAdapter {
  readonly supportedType = 'audio' as const;
  private readonly logger = new Logger(SpeechToTextAdapter.name);

  constructor(private readonly cb: CircuitBreakerService) {}

  async toText(input: MultimodalInput): Promise<string> {
    if (!input.mediaUrl) {
      return input.content || '[Audio recibido — no se pudo procesar]';
    }

    try {
      const text = await this.cb.execute(
        CB_KEY,
        () => this.transcribe(input.mediaUrl!),
        { timeout: 30_000, errorThreshold: 30, resetTimeout: 120_000 },
      );
      this.logger.log(`[STT] Transcripción exitosa — ${text.length} chars`);
      return text;
    } catch {
      this.logger.warn('[STT] Groq Whisper falló — fallback a texto');
      return input.content
        || '[No pude escuchar tu mensaje de voz. ¿Podés escribirlo?]';
    }
  }

  private async transcribe(mediaUrl: string): Promise<string> {
    const apiKey = process.env['GROQ_API_KEY'];
    if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

    // 1. Descargar el audio del CDN del canal (expira en ~5 min)
    const audioRes = await fetch(mediaUrl);
    if (!audioRes.ok) throw new Error(`No se pudo descargar el audio: ${audioRes.status}`);
    const audioBuffer = await audioRes.arrayBuffer();

    // 2. Enviar a Groq Whisper como multipart/form-data
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
    formData.append('model', WHISPER_MODEL);
    formData.append('language', 'es');
    formData.append('response_format', 'text');

    const res = await fetch(WHISPER_API_URL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body:    formData,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq Whisper error ${res.status}: ${err}`);
    }

    return (await res.text()).trim();
  }
}
