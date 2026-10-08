// pasarelapagos-backend/src/modules/welver/welver.module.ts
import { Module } from '@nestjs/common';
import { PaymentProjectStrategyModule } from '@/core/strategies/project-strategy.module.js';
import { OrganizationConfigModule } from '@/core/organization-config/organization-config.module.js';
import { WelverController } from '@/modules/welver/welver.controller.js';
import { WelverPaymentStrategy } from '@/modules/welver/welver.strategy.js';

@Module({
  imports:     [PaymentProjectStrategyModule, OrganizationConfigModule],
  controllers: [WelverController],
  providers: [WelverPaymentStrategy],
  exports:   [WelverPaymentStrategy],
})
export class WelverPaymentModule {}
