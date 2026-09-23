// pasarelapagos-backend/src/internal/internal.module.ts
import { Module }              from '@nestjs/common';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard.js';
import { InternalController }  from '@/internal/internal.controller.js';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard],
})
export class InternalModule {}
