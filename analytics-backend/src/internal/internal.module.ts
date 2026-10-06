import { Module }             from '@nestjs/common';
import { InternalApiKeyGuard } from '@/internal/internal-api-key.guard';
import { InternalController }  from '@/internal/internal.controller';
import { InternalService }     from '@/internal/internal.service';

@Module({
  controllers: [InternalController],
  providers:   [InternalApiKeyGuard, InternalService],
})
export class InternalModule {}
