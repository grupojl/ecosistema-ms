// workers-backend/src/internal/internal.module.ts
import { Module }              from '@nestjs/common';
import { InternalApiKeyGuard } from './internal-api-key.guard.js';
import { InternalController }  from './internal.controller.js';
import { DlqModule }           from '../dlq/dlq.module.js';

@Module({
  imports:     [DlqModule],
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard],
})
export class InternalModule {}
