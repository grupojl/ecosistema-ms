// chatia-backend/src/infrastructure/channels/adapters/image-to-text.adapter.ts
//
// Cadena configurable en IMAGE_PROVIDERS (default: anthropic,groq,siliconflow):
//   anthropic   → Claude Haiku (hoy)           · ANTHROPIC_API_KEY
//   groq        → Llama 4 Scout (planeado)     · GROQ_API_KEY, GROQ_VISION_MODEL
//   siliconflow → Qwen3-VL-32B (fallback)      · SILICONFLOW_API_KEY, SILICONFLOW_VISION_MODEL
// Para migrar a Scout como primario: IMAGE_PROVIDERS=groq,siliconflow (o con anthropic al final).
// Probar con imágenes reales (DNI, facturas, capturas) antes de migrar.
// Cada proveedor con su circuit breaker. Si toda la cadena cae → caption / mensaje genérico.
// Ref: .claude/infrastructure/providers-fallback.md · multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import {
  ProviderChainService,
  type ChainStep,
} from '@/infrastructure/providers/provider-chain.service.js';
import { parseProviderOrder } from '@/infrastructure/providers/provider-order.js';
import {
  chatCompletion,
  resolveEndpoint,
} from '@/infrastructure/providers/openai-compat.client.js';
import type {
  IMultimodalAdapter,
  MultimodalInput,
} from '@/infrastructure/channels/adapters/multimodal.interface.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5';
const IMAGE_PROVIDER_NAMES = ['anthropic', 'groq', 'siliconflow'] as const;
const CB_OPTIONS = {
  timeout: 15_000,
  errorThreshold: 30,
  resetTimeout: 120_000,
};

// Prompt base — puede ser sobreescrito por config de la org
const DEFAULT_PROMPT = `Describí esta imagen en detalle en español.
Si contiene texto, transcribilo completo.
Si es un documento oficial (DNI, factura, formulario, certificado), identificá el tipo y extraé los datos principales.
Si muestra un problema o desperfecto, describí qué es y dónde está.
Sé preciso y conciso.`;

interface DownloadedImage {
  base64: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
}

@Injectable()
export class ImageToTextAdapter implements IMultimodalAdapter {
  readonly supportedType = 'image' as const;
  private readonly logger = new Logger(ImageToTextAdapter.name);

  constructor(private readonly chain: ProviderChainService) {}

  async toText(input: MultimodalInput): Promise<string> {
    if (!input.mediaUrl) {
      return input.content || '[Imagen recibida sin URL]';
    }

    try {
      const image = await this.download(input.mediaUrl, input.mediaHeaders);
      const prompt = input.content
        ? `${DEFAULT_PROMPT}\n\nEl usuario agregó este caption: "${input.content}"`
        : DEFAULT_PROMPT;

      const { value, provider } = await this.chain.run(
        'image',
        this.buildSteps(image, prompt),
      );
      this.logger.log(
        `[IMG] ${provider} — descripción exitosa, ${value.length} chars`,
      );
      return `[Imagen enviada por el usuario]\n${value}`;
    } catch {
      this.logger.warn('[IMG] cadena agotada — fallback');
      return input.content
        ? `[El usuario envió una imagen con el siguiente caption: ${input.content}]`
        : '[El usuario envió una imagen. No pude analizarla en este momento.]';
    }
  }

  private async download(
    mediaUrl: string,
    headers?: Record<string, string>,
  ): Promise<DownloadedImage> {
    const res = await fetch(mediaUrl, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok)
      throw new Error(`No se pudo descargar la imagen: ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = (res.headers
      .get('content-type')
      ?.split(';')[0]
      ?.trim() ?? 'image/jpeg') as DownloadedImage['contentType'];
    return { base64: buffer.toString('base64'), contentType };
  }

  private buildSteps(
    image: DownloadedImage,
    prompt: string,
  ): ChainStep<string>[] {
    const order = parseProviderOrder(
      process.env['IMAGE_PROVIDERS'],
      IMAGE_PROVIDER_NAMES,
      IMAGE_PROVIDER_NAMES,
    );

    return order.map((name): ChainStep<string> => {
      if (name === 'anthropic') {
        const apiKey = process.env['ANTHROPIC_API_KEY'];
        return {
          provider: name,
          cbKey: 'claude-vision-image',
          enabled: Boolean(apiKey),
          cb: CB_OPTIONS,
          run: () => this.describeWithClaude(image, prompt, apiKey ?? ''),
        };
      }

      const endpoint = resolveEndpoint(name);
      const model =
        name === 'groq'
          ? (process.env['GROQ_VISION_MODEL'] ??
            'meta-llama/llama-4-scout-17b-16e-instruct')
          : (process.env['SILICONFLOW_VISION_MODEL'] ??
            'Qwen/Qwen3-VL-32B-Instruct');

      return {
        provider: name,
        cbKey: `${name}-vision-image`,
        enabled: Boolean(endpoint.apiKey),
        cb: CB_OPTIONS,
        run: async () => {
          const result = await chatCompletion(endpoint, {
            model,
            temperature: 0.2,
            maxTokens: 1024,
            timeoutMs: CB_OPTIONS.timeout,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${image.contentType};base64,${image.base64}`,
                    },
                  },
                  { type: 'text', text: prompt },
                ],
              },
            ],
          });
          return result.content;
        },
      };
    });
  }

  private async describeWithClaude(
    image: DownloadedImage,
    prompt: string,
    apiKey: string,
  ): Promise<string> {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: image.contentType,
                  data: image.base64,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(CB_OPTIONS.timeout),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(
        `Claude Vision error ${res.status}: ${err.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = data.content.find((b) => b.type === 'text')?.text;
    if (!text) throw new Error('Claude Vision: respuesta vacía');
    return text;
  }
}
