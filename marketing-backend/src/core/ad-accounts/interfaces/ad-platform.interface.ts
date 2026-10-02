// marketing-backend/src/core/ad-accounts/interfaces/ad-platform.interface.ts
// Contrato que todos los adapters de plataforma implementan.
// El core solo conoce esta interface — nunca las clases concretas.

export interface AdMetricsSummary {
  impressions: number;
  clicks:      number;
  spend:       number;
  conversions: number;
  currency:    string;
}

export interface IAdPlatform {
  readonly platformId: string;
  getMetrics(params: {
    accountId:      string;
    from:           Date;
    to:             Date;
    organizationId: string;
  }): Promise<AdMetricsSummary>;
  isHealthy(): Promise<boolean>;
}
