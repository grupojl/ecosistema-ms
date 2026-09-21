// chatia-backend/src/channels/adapters/image-to-text.adapter.ts
//
// Proveedor: Claude Vision (Anthropic API)
// Por qué: mejor comprensión de imágenes en español, documentos y contexto
// Costo: ~$0.003 por imagen (claude-haiku-4-5)
// Latencia: ~500ms
//
// Circuit breaker obligatorio — si Claude Vision falla → fallback a descripción genérica
// Prompt base configurable por organizationId vía config
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerService } from '../../common/services/circuit-breaker.service.js';
import type { IMultimodalAdapter, MultimodalInput } from './multimodal.interface.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL      = 'claude-haiku-4-5';
const CB_KEY            = 'claude-vision-image';

// Prompt base — puede ser sobreescrito por config de la org
const DEFAULT_PROMPT = `Describí esta imagen en detalle en español.
Si contiene texto, transcribilo completo.
Si es un documento oficial (DNI, factura, formulario, certificado), identificá el tipo y extraé los datos principales.
Si muestra un problema o desperfecto, describí qué es y dónde está.
S� preciso y conciso.`;

@Injectable()
export class ImageToTextAdapter implements IMultimodalAdapter {
  readonly supportedType = 'image' as const;
  private readonly logger = new Logger(ImageToTextAdapter.name);

  constructor(private readonly cb: CircuitBreakerService) {}

  async toText(input: MultimodalInput): Promise<string> {
    if (!input.mediaUrl) {
      return input.content || '[Imagen recibida sin URL]';
    }

    try {
      const description = await this.cb.execute(
        CB_KEY,
        () => this.describe(input.mediaUrl!, input.content),
        { timeout: 15_000, errorThreshold: 30, resetTimeout: 120_000 },
      );
      this.logger.log(`[IMG] Descripción exitosa — ${description.length} chars`);
      return `[Imagen enviada por el usuario]\n${description}`;
    } catch {
      this.logger.warn('[IMG] Claude Vision falló — fallback');
      return input.content
        ? `[El usuario envió una imagen con el siguiente caption: ${input.content}]`
        : '[El usuario envió una imagen. No pude analizarla en este momento.]';
    }
  }

  private async describe(mediaUrl: string, caption: string): Promise<string> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada');

    // Descargar imagen y convertir a base64
    const imgRes = await fetch(mediaUrl);
    if (!imgRes.ok) throw new Error(`No se pudo descargar la imagen: ${imgRes.status}`);

    const buffer      = Buffer.from(await imgRes.arrayBuffer());
    const base64      = buffer.toString('base64');
    const contentType = (imgRes.headers.get('content-type') ?? 'image/jpeg') as
      'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    const prompt = caption
      ? `${DEFAULT_PROMPT}\n\nEl usuario agregó este caption: "${caption}"`
      : DEFAULT_PROMPT;

    const res = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      CLAUDE_MODEL,
        max_tokens: 1024,
        messages: [{
          role:    'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: contentType, data: base64 } },
            { type: 'text',  text: prompt },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude Vision error ${res.status}: ${err}`);
    }

    const data = await res.json() as { content: Array<{ type: string; text?: string }> };
    return data.content.find(b => b.type === 'text')?.text ?? '';
  }
}
