import { Module } from '@nestjs/common';
import { ApiKeyService } from '@/modules/tenants/api-key.service';
import { TenantsController } from '@/modules/tenants/tenants.controller';

@Module({
  providers:   [ApiKeyService],
  controllers: [TenantsController],
  exports:     [ApiKeyService],
})
export class TenantsModule {}
