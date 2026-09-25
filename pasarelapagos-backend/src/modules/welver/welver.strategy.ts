// pasarelapagos-backend/src/modules/welver/welver.strategy.ts
// Strategy de pagos para el ecosistema Welver. NUNCA lanza en enrich/after.
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PaymentProjectStrategyRegistry } from '../../core/strategies/project-strategy.registry.js';
import { PaymentOrgConfigService }        from '../../organization-config/organization-config.service.js';
import {
  ProjectType, type PaymentProjectStrategy,
  type PaymentEnrichInput, type ChargeResult,
} from '../../core/strategies/project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE, type PaymentProjectContext, type OrganizationProfile,
} from '../../core/strategies/project-context.interface.js';
import type { WelverPaymentData } from './types/context.js';

@Injectable()
export class WelverPaymentStrategy implements PaymentProjectStrategy, OnModuleInit {
  private readonly logger = new Logger(WelverPaymentStrategy.name);

  constructor(
    private readonly registry:  PaymentProjectStrategyRegistry,
    private readonly orgConfig: PaymentOrgConfigService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('WelverPaymentStrategy registrada');
  }

  getProjectType(): ProjectType { return ProjectType.WELVER; }

  async enrichPaymentContext(input: PaymentEnrichInput): Promise<PaymentProjectContext> {
    try {
      const orgProfile = await this.orgConfig.resolve(input.ecosystemId, input.organizationId);

      // Resolver provider óptimo para país + método + flags de la org
      const provider = this.resolveProvider(input, orgProfile);

      const bizData: WelverPaymentData = {
        preferredProvider:  provider as WelverPaymentData['preferredProvider'],
        primaryCountry:     input.country,
        maxInstallments:    orgProfile.featureFlags.installmentsEnabled ? 12 : 1,
        merchantPlan:       orgProfile.plan === 'custom' ? 'enterprise' : orgProfile.plan,
        enabledCurrencies:  this.currenciesForCountry(input.country),
      };

      return {
        preferredProvider:  provider,
        enabledProviders:   this.enabledProviders(orgProfile),
        enabledCurrencies:  bizData.enabledCurrencies,
        orgProfile,
        businessData:       bizData,
      };
    } catch (err: unknown) {
      this.logger.error(`WelverPaymentStrategy.enrich falló: ${err instanceof Error ? err.message : String(err)}`);
      return {
        preferredProvider: 'mercadopago',
        enabledProviders:  ['mercadopago'],
        enabledCurrencies: ['ARS'],
        orgProfile:        { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
        businessData:      {},
      };
    }
  }

  async afterChargeResult(result: ChargeResult, _context: PaymentProjectContext): Promise<void> {
    try {
      this.logger.debug(
        `[welver-pagos] charge result — pay=${result.paymentId} status=${result.status} provider=${result.provider}`,
      );
      // TODO(ECO-H-04): emitir evento a analytics-backend vía gRPC cuando el status sea CAPTURED
    } catch (err: unknown) {
      this.logger.error(`WelverPaymentStrategy.after falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    return this.orgConfig.resolve(ecosystemId, organizationId);
  }

  // ── helpers privados ──────────────────────────────────────────────────────

  private resolveProvider(input: PaymentEnrichInput, orgProfile: OrganizationProfile): string {
    // Stripe primero si está habilitado y el método es card
    if (orgProfile.featureFlags.stripeEnabled && input.method === 'card') return 'stripe';
    // dLocal para países no-LATAM con habilitación explícita
    if (orgProfile.featureFlags.dlocalEnabled && !['AR','MX','CO','CL','BR','PE'].includes(input.country)) return 'dlocal';
    // MercadoPago como default para LATAM
    return 'mercadopago';
  }

  private enabledProviders(orgProfile: OrganizationProfile): string[] {
    const providers: string[] = ['mercadopago'];
    if (orgProfile.featureFlags.stripeEnabled)      providers.unshift('stripe');
    if (orgProfile.featureFlags.dlocalEnabled)       providers.push('dlocal');
    return providers;
  }

  private currenciesForCountry(country: string): string[] {
    const map: Record<string, string[]> = {
      AR: ['ARS', 'USD'], MX: ['MXN', 'USD'], CO: ['COP', 'USD'],
      CL: ['CLP', 'USD'], BR: ['BRL', 'USD'], PE: ['PEN', 'USD'],
    };
    return map[country] ?? ['USD'];
  }
}
