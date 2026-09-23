// chatia-backend/src/channels/multimodal.module.ts
import { Module }                from '@nestjs/common';
import { SpeechToTextAdapter }   from '@/channels/adapters/speech-to-text.adapter.js';
import { ImageToTextAdapter }    from '@/channels/adapters/image-to-text.adapter.js';
import { DocumentToTextAdapter } from '@/channels/adapters/document-to-text.adapter.js';
import { LocationToTextAdapter } from '@/channels/adapters/location-to-text.adapter.js';
import { VideoToTextAdapter }    from '@/channels/adapters/video-to-text.adapter.js';
import { TextToSpeechAdapter }   from '@/channels/adapters/text-to-speech.adapter.js';
import { MultimodalService }     from '@/channels/multimodal.service.js';

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
