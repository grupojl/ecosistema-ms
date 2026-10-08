// GoogleAdsAdapter — Google Ads API
// Fase 2: la integración real con Google Ads API todavía no está implementada.
// Degradación elegante (igual que MetaAdsAdapter): no lanza, loguea warn y retorna vacío.
// Norte Triple Whale: solo spend/clicks/impressions — nunca revenue de la plataforma.
import { Injectable, Logger } from '@nestjs/common';
import type {
  AdPlatformInterface,
  CampaignSyncResult,
  DailyMetricData,
} from '@/ad-accounts/adapters/ad-platform.interface.js';

@Injectable()
export class GoogleAdsAdapter implements AdPlatformInterface {
  private readonly logger = new Logger(GoogleAdsAdapter.name);

  async syncCampaigns(accountExternalId: string, _accessToken: string): Promise<CampaignSyncResult[]> {
    this.logger.warn(`[GoogleAds] syncCampaigns ${accountExternalId}: integración pendiente (Fase 2)`);
    return [];
  }

  async getCampaignMetrics(
    campaignExternalId: string,
    _accessToken: string,
    _dateFrom: Date,
    _dateTo: Date,
  ): Promise<DailyMetricData[]> {
    this.logger.warn(`[GoogleAds] getCampaignMetrics ${campaignExternalId}: integración pendiente (Fase 2)`);
    return [];
  }

  async pauseCampaign(campaignExternalId: string, _accessToken: string): Promise<void> {
    this.logger.warn(`[GoogleAds] pauseCampaign ${campaignExternalId}: integración pendiente (Fase 2) — sin efecto`);
  }

  async scaleBudget(campaignExternalId: string, _accessToken: string, _factor: number): Promise<void> {
    this.logger.warn(`[GoogleAds] scaleBudget ${campaignExternalId}: integración pendiente (Fase 2) — sin efecto`);
  }
}
