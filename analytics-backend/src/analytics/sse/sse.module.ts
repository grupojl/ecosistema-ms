// analytics-backend/src/analytics/sse/sse.module.ts
import { Module }     from '@nestjs/common';
import { SseService } from '@/analytics/sse/sse.service.js';

@Module({ providers: [SseService], exports: [SseService] })
export class SseModule {}
