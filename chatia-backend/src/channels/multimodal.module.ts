// chatia-backend/src/channels/multimodal.module.ts
import { Module }                from '@nestjs/common';
import { SpeechToTextAdapter }   from './adapters/speech-to-text.adapter.js';
import { ImageToTextAdapter }    from './adapters/image-to-text.adapter.js';
import { DocumentToTextAdapter } from './adapters/document-to-text.adapter.js';
import { LocationToTextAdapter } from './adapters/location-to-text.adapter.js';
import { VideoToTextAdapter }    from './adapters/video-to-text.adapter.js';
import { TextToSpeechAdapter }   from './adapters/text-to-speech.adapter.js';
import { MultimodalService }     from './multimodal.service.js';

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
