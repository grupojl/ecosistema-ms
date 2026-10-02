import { Module }                         from "@nestjs/common";
import { OrganizationConfigService }       from "@/core/organization-config/organization-config.service.js";

@Module({
  providers: [OrganizationConfigService],
  exports:   [OrganizationConfigService],
})
export class OrganizationConfigModule {}
