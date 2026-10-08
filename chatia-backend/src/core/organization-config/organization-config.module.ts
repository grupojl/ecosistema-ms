// chatia-backend/src/organization-config/organization-config.module.ts
import { Global, Module } from '@nestjs/common';
import { OrganizationConfigService }          from '@/core/organization-config/organization-config.service.js';
import { PrismaOrganizationConfigRepository } from '@/core/organization-config/prisma-organization-config.repository.js';
import { ORGANIZATION_CONFIG_REPO }           from '@/core/organization-config/organization-config.repository.interface.js';

@Global()
@Module({
  providers: [
    OrganizationConfigService,
    { provide: ORGANIZATION_CONFIG_REPO, useClass: PrismaOrganizationConfigRepository },
  ],
  exports: [OrganizationConfigService],
})
export class OrganizationConfigModule {}
