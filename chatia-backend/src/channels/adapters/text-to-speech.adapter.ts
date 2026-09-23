// chatia-backend/src/channels/adapters/text-to-speech.adapter.ts
//
// Proveedor: Cartesia
// Por qué: ~40ms tiempo al primer audio, voz clonada por org
// Se usa cuando: el mensaje entrante era 'audio' → responder con audio
//
// Circuit breaker obligatorio
// Voz configurable por organizationId — cada org tiene su propia voz
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '@/common/services/circuit-breaker.service.js';

const CARTESIA_API_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2024-06-10';
const CB_KEY           = 'cartesia-tts';

// Voice ID por defecto en español — reemplazar por voz clonada de la org
const DEFAULT_VOICE_ID = 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Español neutro Cartesia

export interface TtsResult {
  audioBuffer: Buffer;
  mimeType:    string;
}

@Injectable()
export class TextToSpeechAdapter {
  private readonly logger = new Logger(TextToSpeechAdapter.name);

  constructor(private readonly cb: CircuitBreakerService) {}

  async toAudio(text: string, voiceId?: string): Promise<TtsResult | null> {
    try {
      const result = await this.cb.execute(
        CB_KEY,
        () => this.synthesize(text, voiceId ?? DEFAULT_VOICE_ID),
        { timeout: 10_000, errorThreshold: 30, resetTimeout: 60_000 },
      );
      this.logger.log(`[TTS] Síntesis exitosa — ${result.audioBuffer.length} bytes`);
      return result;
    } catch {
      this.logger.warn('[TTS] Cartesia falló — responder en texto');
      return null; // null = responder en texto
    }
  }

  private async synthesize(text: string, voiceId: string): Promise<TtsResult> {
    const apiKey = process.env['CARTESIA_API_KEY'];
    if (!apiKey) throw new Error('CARTESIA_API_KEY no configurada');

    const res = await fetch(CARTESIA_API_URL, {
      method:  'POST',
      headers: {
        'Cartesia-Version': CARTESIA_VERSION,
        'X-API-Key':        apiKey,
        'Content-Type':     'application/json',
      },
      body: JSON.stringify({
        model_id:    'sonic-multilingual',
        transcript:  text,
        voice:       { mode: 'id', id: voiceId },
        output_format: {
          container:   'ogg',
          encoding:    'opus',
          sample_rate: 24000,
        },
        language: 'es',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cartesia error ${res.status}: ${err}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return { audioBuffer, mimeType: 'audio/ogg' };
  }
}
