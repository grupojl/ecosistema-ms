// chatia-backend/src/core/organization-config/organization-config.module.ts
// El binding ORGANIZATION_CONFIG_REPO → implementación Prisma vive en infrastructure/prisma/prisma.module.ts.
import { Global, Module } from '@nestjs/common';
import { OrganizationConfigService } from '@/core/organization-config/organization-config.service.js';

@Global()
@Module({
  providers: [OrganizationConfigService],
  exports: [OrganizationConfigService],
})
export class OrganizationConfigModule {}
