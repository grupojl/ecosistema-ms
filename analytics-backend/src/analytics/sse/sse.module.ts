// analytics-backend/src/analytics/sse/sse.module.ts
import { Module }     from '@nestjs/common';
import { SseService } from './sse.service.js';

@Module({ providers: [SseService], exports: [SseService] })
export class SseModule {}
