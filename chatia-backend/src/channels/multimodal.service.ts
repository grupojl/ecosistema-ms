// chatia-backend/src/channels/multimodal.service.ts
//
// Orquestador central de adapters multimodales.
// Recibe un IncomingMessage del canal y normaliza su contenido a texto.
// Es el ÚNICO punto donde se decide qué adapter usar.
// Los módulos de conversación no saben qué adapter corrió.
//
// Invariante: el LLM siempre recibe texto — este service garantiza eso.
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import { SpeechToTextAdapter }   from '@/channels/adapters/speech-to-text.adapter.js';
import { ImageToTextAdapter }    from '@/channels/adapters/image-to-text.adapter.js';
import { DocumentToTextAdapter } from '@/channels/adapters/document-to-text.adapter.js';
import { LocationToTextAdapter } from '@/channels/adapters/location-to-text.adapter.js';
import { VideoToTextAdapter }    from '@/channels/adapters/video-to-text.adapter.js';
import { TextToSpeechAdapter }   from '@/channels/adapters/text-to-speech.adapter.js';
import type { IncomingMessage }  from '@/channels/channel.interface.js';
import type { TtsResult }        from '@/channels/adapters/text-to-speech.adapter.js';

export interface NormalizedMessage {
  text:           string;   // texto para el LLM — siempre presente
  originalType:   string;   // tipo original del mensaje
  wasConverted:   boolean;  // true si se aplicó un adapter
  respondWithAudio: boolean; // true si la respuesta debería ser audio
}

@Injectable()
export class MultimodalService {
  private readonly logger = new Logger(MultimodalService.name);

  constructor(
    private readonly stt: SpeechToTextAdapter,
    private readonly img: ImageToTextAdapter,
    private readonly doc: DocumentToTextAdapter,
    private readonly loc: LocationToTextAdapter,
    private readonly vid: VideoToTextAdapter,
    readonly tts: TextToSpeechAdapter, // público para uso en ConversationsService
  ) {}

  // Normaliza cualquier tipo de mensaje a texto para el LLM
  async normalize(msg: IncomingMessage, organizationId: string): Promise<NormalizedMessage> {
    const input = {
      mediaUrl:       msg.mediaUrl,
      content:        msg.content,
      raw:            msg.raw,
      organizationId,
    };

    switch (msg.type) {
      case 'text':
        return { text: msg.content, originalType: 'text', wasConverted: false, respondWithAudio: false };

      case 'audio': {
        const text = await this.stt.toText(input);
        this.logger.log(`[STT] audio → texto: "${text.slice(0, 80)}..."`);
        return { text, originalType: 'audio', wasConverted: true, respondWithAudio: true };
      }

      case 'image': {
        const text = await this.img.toText(input);
        return { text, originalType: 'image', wasConverted: true, respondWithAudio: false };
      }

      case 'document': {
        const text = await this.doc.toText(input);
        return { text, originalType: 'document', wasConverted: true, respondWithAudio: false };
      }

      case 'location': {
        const text = await this.loc.toText(input);
        return { text, originalType: 'location', wasConverted: true, respondWithAudio: false };
      }

      case 'video': {
        const text = await this.vid.toText(input);
        return { text, originalType: 'video', wasConverted: true, respondWithAudio: false };
      }

      case 'sticker':
        return { text: '[El usuario envió un sticker]', originalType: 'sticker', wasConverted: false, respondWithAudio: false };

      default:
        return { text: msg.content || '[Mensaje no soportado]', originalType: msg.type, wasConverted: false, respondWithAudio: false };
    }
  }

  // Convierte texto a audio si el canal lo requiere
  async toAudio(text: string, organizationId: string): Promise<TtsResult | null> {
    // TODO(fase2): leer voiceId de config por organizationId
    return this.tts.toAudio(text);
  }
}
