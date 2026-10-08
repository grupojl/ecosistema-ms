// pasarelapagos-backend/src/modules/manzana/manzana.module.ts
import { Module } from '@nestjs/common';
import { PaymentProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { OrganizationConfigModule } from '@/core/organization-config/organization-config.module.js';
import { ManzanaController } from '@/modules/manzana/manzana.controller.js';
// TODO: agregar ManzanaPaymentStrategy cuando se integre
@Module({
  imports:     [PaymentProjectStrategyModule, OrganizationConfigModule],
  controllers: [ManzanaController],
})
export class ManzanaPaymentModule {}
