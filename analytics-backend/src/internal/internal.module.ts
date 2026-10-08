import { Module }             from '@nestjs/common';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard.js';
import { InternalController }  from '@/internal/internal.controller.js';
import { InternalService }     from '@/internal/internal.service.js';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}
