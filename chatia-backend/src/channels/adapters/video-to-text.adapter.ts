// chatia-backend/src/channels/adapters/video-to-text.adapter.ts
//
// Proveedor: Gemini 2.0 Flash (Fase 2)
// Estado: stub — responde con fallback amigable hasta implementar
// TODO(fase2): implementar con Google AI SDK cuando el volumen lo justifique
//
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import type { IMultimodalAdapter, MultimodalInput } from './multimodal.interface.js';

@Injectable()
export class VideoToTextAdapter implements IMultimodalAdapter {
  readonly supportedType = 'video' as const;
  private readonly logger = new Logger(VideoToTextAdapter.name);

  async toText(input: MultimodalInput): Promise<string> {
    this.logger.debug('[VIDEO] Fase 2 — retornando fallback');
    return input.content
      ? `[El usuario envió un video con el caption: "${input.content}". Por ahora no puedo procesar videos. ¿Podés describirme qué muestra o mandarme una foto?]`
      : '[Recibí tu video. Por ahora no puedo procesarlo. ¿Podés describirme qué muestra o mandarme una foto?]';
  }
}
