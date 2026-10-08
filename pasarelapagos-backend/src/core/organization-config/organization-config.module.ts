import { Module }                         from "@nestjs/common";
import { PaymentOrgConfigService }        from "@/core/organization-config/organization-config.service.js";
import { PrismaPaymentOrgConfigRepository } from "@/core/organization-config/prisma-organization-config.repository.js";
import { PAYMENT_ORG_CONFIG_REPO }        from "@/core/organization-config/organization-config.repository.interface.js";

@Module({
  providers: [
    PaymentOrgConfigService,
    { provide: PAYMENT_ORG_CONFIG_REPO, useClass: PrismaPaymentOrgConfigRepository },
  ],
  exports: [PaymentOrgConfigService],
})
export class OrganizationConfigModule {}
