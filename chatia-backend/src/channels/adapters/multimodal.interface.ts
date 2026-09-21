// chatia-backend/src/channels/adapters/multimodal.interface.ts
//
// Contrato que todos los adapters de entrada multimodal implementan.
// El LLM SIEMPRE recibe texto — los adapters normalizan la entrada.
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md

export interface MultimodalInput {
  mediaUrl?: string;                    // URL del archivo en CDN del canal
  content:   string;                    // texto adicional (caption, descripción)
  raw:       Record<string, unknown>;   // payload completo del canal
  organizationId: string;               // para config por org
}

export interface IMultimodalAdapter {
  readonly supportedType: 'audio' | 'image' | 'video' | 'document' | 'location';
  toText(input: MultimodalInput): Promise<string>;
}

export const MULTIMODAL_ADAPTER_TOKENS = {
  SPEECH_TO_TEXT:   'SPEECH_TO_TEXT_ADAPTER',
  IMAGE_TO_TEXT:    'IMAGE_TO_TEXT_ADAPTER',
  DOCUMENT_TO_TEXT: 'DOCUMENT_TO_TEXT_ADAPTER',
  LOCATION_TO_TEXT: 'LOCATION_TO_TEXT_ADAPTER',
  TEXT_TO_SPEECH:   'TEXT_TO_SPEECH_ADAPTER',
  VIDEO_TO_TEXT:    'VIDEO_TO_TEXT_ADAPTER',
} as const;
