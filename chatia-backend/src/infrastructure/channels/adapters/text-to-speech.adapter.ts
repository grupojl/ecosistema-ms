// chatia-backend/src/infrastructure/channels/adapters/text-to-speech.adapter.ts
//
// Cadena: Cartesia → ElevenLabs Flash (orden en TTS_PROVIDERS). Ambos con voz clonada por org.
// Cada proveedor con su circuit breaker. Si toda la cadena cae → responder en texto (null).
// Se usa cuando: el mensaje entrante era 'audio' → responder con audio
// Los voice ids son distintos por proveedor: se pasan como { cartesia, elevenlabs }.
// Ref: .claude/infrastructure/providers-fallback.md · multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderChainService,
  type ChainStep,
} from '@/infrastructure/providers/provider-chain.service.js';
import { parseProviderOrder } from '@/infrastructure/providers/provider-order.js';

const CARTESIA_API_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_VERSION = '2024-06-10';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const TTS_PROVIDER_NAMES = ['cartesia', 'elevenlabs'] as const;
const CB_OPTIONS = {
  timeout: 10_000,
  errorThreshold: 30,
  resetTimeout: 60_000,
};

// Voice ID por defecto en español — reemplazar por voz clonada de la org
const DEFAULT_CARTESIA_VOICE_ID = 'a0e99841-438c-4a64-b679-ae501e7d6091'; // Español neutro Cartesia

export interface TtsResult {
  audioBuffer: Buffer;
  mimeType: string;
}

/** Voice id por proveedor. Un string suelto se interpreta como voz de Cartesia (compatibilidad). */
export interface TtsVoice {
  cartesia?: string;
  elevenlabs?: string;
}

@Injectable()
export class TextToSpeechAdapter {
  private readonly logger = new Logger(TextToSpeechAdapter.name);

  constructor(private readonly chain: ProviderChainService) {}

  async toAudio(
    text: string,
    voice?: string | TtsVoice,
  ): Promise<TtsResult | null> {
    const voices: TtsVoice =
      typeof voice === 'string' ? { cartesia: voice } : (voice ?? {});

    try {
      const { value, provider } = await this.chain.run(
        'tts',
        this.buildSteps(text, voices),
      );
      this.logger.log(
        `[TTS] ${provider} — síntesis exitosa, ${value.audioBuffer.length} bytes`,
      );
      return value;
    } catch {
      this.logger.warn('[TTS] cadena agotada — responder en texto');
      return null; // null = responder en texto
    }
  }

  private buildSteps(text: string, voices: TtsVoice): ChainStep<TtsResult>[] {
    const order = parseProviderOrder(
      process.env['TTS_PROVIDERS'],
      TTS_PROVIDER_NAMES,
      TTS_PROVIDER_NAMES,
    );

    return order.map((name): ChainStep<TtsResult> => {
      if (name === 'cartesia') {
        const apiKey = process.env['CARTESIA_API_KEY'];
        return {
          provider: name,
          cbKey: 'cartesia-tts',
          enabled: Boolean(apiKey),
          cb: CB_OPTIONS,
          run: () =>
            this.synthesizeCartesia(
              text,
              voices.cartesia ?? DEFAULT_CARTESIA_VOICE_ID,
              apiKey ?? '',
            ),
        };
      }

      const apiKey = process.env['ELEVENLABS_API_KEY'];
      const voiceId =
        voices.elevenlabs ?? process.env['ELEVENLABS_DEFAULT_VOICE_ID'];
      return {
        provider: name,
        cbKey: 'elevenlabs-tts',
        enabled: Boolean(apiKey && voiceId),
        cb: CB_OPTIONS,
        run: () => this.synthesizeElevenLabs(text, voiceId ?? '', apiKey ?? ''),
      };
    });
  }

  private async synthesizeCartesia(
    text: string,
    voiceId: string,
    apiKey: string,
  ): Promise<TtsResult> {
    const res = await fetch(CARTESIA_API_URL, {
      method: 'POST',
      headers: {
        'Cartesia-Version': CARTESIA_VERSION,
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-multilingual',
        transcript: text,
        voice: { mode: 'id', id: voiceId },
        output_format: {
          container: 'ogg',
          encoding: 'opus',
          sample_rate: 24000,
        },
        language: 'es',
      }),
      signal: AbortSignal.timeout(CB_OPTIONS.timeout),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Cartesia error ${res.status}: ${err.slice(0, 300)}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return { audioBuffer, mimeType: 'audio/ogg' };
  }

  // Verificar contra la doc de ElevenLabs que ELEVENLABS_OUTPUT_FORMAT entregue Opus en contenedor
  // Ogg (formato que exige WhatsApp para notas de voz); si no, convertir con ffmpeg.
  private async synthesizeElevenLabs(
    text: string,
    voiceId: string,
    apiKey: string,
  ): Promise<TtsResult> {
    const format = process.env['ELEVENLABS_OUTPUT_FORMAT'] ?? 'opus_48000_64';
    const url = `${ELEVENLABS_API_URL}/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(format)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: process.env['ELEVENLABS_MODEL'] ?? 'eleven_flash_v2_5',
        language_code: 'es',
      }),
      signal: AbortSignal.timeout(CB_OPTIONS.timeout),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs error ${res.status}: ${err.slice(0, 300)}`);
    }

    const audioBuffer = Buffer.from(await res.arrayBuffer());
    return { audioBuffer, mimeType: 'audio/ogg' };
  }
}
