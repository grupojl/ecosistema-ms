// chatia-backend/src/infrastructure/channels/multimodal.module.ts
import { Module } from '@nestjs/common';
import { SpeechToTextAdapter } from '@/infrastructure/channels/adapters/speech-to-text.adapter.js';
import { ImageToTextAdapter } from '@/infrastructure/channels/adapters/image-to-text.adapter.js';
import { DocumentToTextAdapter } from '@/infrastructure/channels/adapters/document-to-text.adapter.js';
import { LocationToTextAdapter } from '@/infrastructure/channels/adapters/location-to-text.adapter.js';
import { VideoToTextAdapter } from '@/infrastructure/channels/adapters/video-to-text.adapter.js';
import { TextToSpeechAdapter } from '@/infrastructure/channels/adapters/text-to-speech.adapter.js';
import { MultimodalService } from '@/infrastructure/channels/multimodal.service.js';

@Module({
  providers: [
    SpeechToTextAdapter,
    ImageToTextAdapter,
    DocumentToTextAdapter,
    LocationToTextAdapter,
    VideoToTextAdapter,
    TextToSpeechAdapter,
    MultimodalService,
  ],
  exports: [MultimodalService],
})
export class MultimodalModule {}
