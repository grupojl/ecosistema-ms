// pasarelapagos-backend/src/core/strategies/generic.strategy.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  ProjectType, type PaymentProjectStrategy,
  type PaymentEnrichInput, type ChargeResult,
} from './project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE, type PaymentProjectContext, type OrganizationProfile,
} from './project-context.interface.js';

@Injectable()
export class GenericPaymentStrategy implements PaymentProjectStrategy {
  private readonly logger = new Logger(GenericPaymentStrategy.name);

  getProjectType(): ProjectType { return ProjectType.GENERIC; }

  async enrichPaymentContext(input: PaymentEnrichInput): Promise<PaymentProjectContext> {
    this.logger.debug(`GenericPaymentStrategy — ${input.ecosystemId}/${input.organizationId}`);
    return {
      preferredProvider: 'mercadopago',
      enabledProviders:  ['mercadopago'],
      enabledCurrencies: ['ARS', 'USD'],
      orgProfile:        { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
      businessData:      {},
    };
  }

  async afterChargeResult(_r: ChargeResult, _c: PaymentProjectContext): Promise<void> { /* no-op */ }

  async resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    return { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };
  }
}
