// chatia-backend/src/infrastructure/transport/internal/internal.module.ts
import { Module } from '@nestjs/common';
import { InternalApiKeyGuard } from '@/infrastructure/transport/internal/internal-api-key.guard.js';
import { InternalController } from '@/infrastructure/transport/internal/internal.controller.js';
import { PrismaModule } from '@/infrastructure/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [InternalController],
  providers: [InternalApiKeyGuard],
})
export class InternalModule {}
