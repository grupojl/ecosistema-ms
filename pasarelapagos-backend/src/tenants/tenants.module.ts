import { Module } from '@nestjs/common';
import { ApiKeyService } from '@/modules/tenants/api-key.service.js';
import { TenantsController } from '@/modules/tenants/tenants.controller.js';

@Module({
  providers:   [ApiKeyService],
  controllers: [TenantsController],
  exports:     [ApiKeyService],
})
export class TenantsModule {}
