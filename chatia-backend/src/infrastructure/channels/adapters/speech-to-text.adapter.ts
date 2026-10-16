// chatia-backend/src/infrastructure/channels/adapters/speech-to-text.adapter.ts
//
// Cadena: Groq Whisper → SiliconFlow audio/transcriptions (orden en STT_PROVIDERS).
// Cada proveedor con su circuit breaker. Si toda la cadena cae → se pide al usuario que escriba.
// SiliconFlow solo se habilita si SILICONFLOW_STT_MODEL está definido: la calidad en español
// de sus modelos no está confirmada, así que el modelo lo elige el operador tras probarlo.
// Ref: .claude/infrastructure/providers-fallback.md · multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderChainService,
  type ChainStep,
} from '@/infrastructure/providers/provider-chain.service.js';
import { parseProviderOrder } from '@/infrastructure/providers/provider-order.js';
import {
  resolveEndpoint,
  transcribeAudio,
  type OpenAiCompatName,
} from '@/infrastructure/providers/openai-compat.client.js';
import type {
  IMultimodalAdapter,
  MultimodalInput,
} from '@/infrastructure/channels/adapters/multimodal.interface.js';

const STT_PROVIDER_NAMES = ['groq', 'siliconflow'] as const;
const CB_KEYS: Record<OpenAiCompatName, string> = {
  groq: 'groq-whisper-stt',
  siliconflow: 'siliconflow-stt',
};
const CB_OPTIONS = {
  timeout: 30_000,
  errorThreshold: 30,
  resetTimeout: 120_000,
};

@Injectable()
export class SpeechToTextAdapter implements IMultimodalAdapter {
  readonly supportedType = 'audio' as const;
  private readonly logger = new Logger(SpeechToTextAdapter.name);

  constructor(private readonly chain: ProviderChainService) {}

  async toText(input: MultimodalInput): Promise<string> {
    if (!input.mediaUrl) {
      return input.content || '[Audio recibido — no se pudo procesar]';
    }

    try {
      // Descargar una sola vez el audio del CDN del canal (expira en ~5 min)
      const audioRes = await fetch(input.mediaUrl, {
        headers: input.mediaHeaders,
        signal: AbortSignal.timeout(15_000),
      });
      if (!audioRes.ok)
        throw new Error(`No se pudo descargar el audio: ${audioRes.status}`);
      const audio = await audioRes.arrayBuffer();

      const { value, provider } = await this.chain.run(
        'stt',
        this.buildSteps(audio),
      );
      this.logger.log(
        `[STT] ${provider} — transcripción exitosa, ${value.length} chars`,
      );
      return value;
    } catch {
      this.logger.warn('[STT] cadena agotada — fallback a texto');
      return (
        input.content ||
        '[No pude escuchar tu mensaje de voz. ¿Podés escribirlo?]'
      );
    }
  }

  private buildSteps(audio: ArrayBuffer): ChainStep<string>[] {
    const order = parseProviderOrder(
      process.env['STT_PROVIDERS'],
      STT_PROVIDER_NAMES,
      STT_PROVIDER_NAMES,
    );

    return order.map((name) => {
      const endpoint = resolveEndpoint(name);
      const model =
        name === 'groq'
          ? (process.env['GROQ_STT_MODEL'] ?? 'whisper-large-v3')
          : process.env['SILICONFLOW_STT_MODEL'];

      return {
        provider: name,
        cbKey: CB_KEYS[name],
        enabled: Boolean(endpoint.apiKey && model),
        cb: CB_OPTIONS,
        run: () =>
          transcribeAudio(endpoint, {
            model: model ?? '',
            audio,
            filename: 'audio.ogg',
            mimeType: 'audio/ogg',
            language: name === 'groq' ? 'es' : undefined,
            timeoutMs: CB_OPTIONS.timeout,
          }),
      };
    });
  }
}
