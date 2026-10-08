import { Module }                         from "@nestjs/common";
import { PaymentOrgConfigService }       from "@/core/organization-config/organization-config.service.js";

@Module({
  providers: [PaymentOrgConfigService],
  exports:   [PaymentOrgConfigService],
})
export class OrganizationConfigModule {}
