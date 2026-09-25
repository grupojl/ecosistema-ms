// chatia-backend/src/organization-config/organization-config.module.ts
import { Global, Module } from '@nestjs/common';
import { OrganizationConfigService }          from './organization-config.service.js';
import { PrismaOrganizationConfigRepository } from './prisma-organization-config.repository.js';
import { ORGANIZATION_CONFIG_REPO }           from './organization-config.repository.interface.js';

@Global()
@Module({
  providers: [
    OrganizationConfigService,
    { provide: ORGANIZATION_CONFIG_REPO, useClass: PrismaOrganizationConfigRepository },
  ],
  exports: [OrganizationConfigService],
})
export class OrganizationConfigModule {}
