import { Module } from '@nestjs/common';
import { ApiKeyService } from '@/tenants/api-key.service.js';
import { TenantsController } from '@/tenants/tenants.controller.js';

@Module({
  providers:   [ApiKeyService],
  controllers: [TenantsController],
  exports:     [ApiKeyService],
})
export class TenantsModule {}
