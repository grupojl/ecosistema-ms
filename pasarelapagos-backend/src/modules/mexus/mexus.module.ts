// pasarelapagos-backend/src/modules/mexus/mexus.module.ts
import { Module } from '@nestjs/common';
import { PaymentProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { OrganizationConfigModule } from '@/core/organization-config/organization-config.module.js';
import { MexusController } from '@/modules/mexus/mexus.controller.js';
// TODO: agregar MexusPaymentStrategy cuando se integre
@Module({
  imports:     [PaymentProjectStrategyModule, OrganizationConfigModule],
  controllers: [MexusController],
})
export class MexusPaymentModule {}
