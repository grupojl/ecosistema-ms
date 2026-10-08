// TiktokAdsAdapter — TikTok Marketing API
// Fase 2: la integración real con TikTok Marketing API todavía no está implementada.
// Degradación elegante (igual que MetaAdsAdapter): no lanza, loguea warn y retorna vacío.
// Norte Triple Whale: solo spend/clicks/impressions — nunca revenue de la plataforma.
import { Injectable, Logger } from '@nestjs/common';
import type {
  AdPlatformInterface,
  CampaignSyncResult,
  DailyMetricData,
} from '@/ad-accounts/adapters/ad-platform.interface.js';

@Injectable()
export class TiktokAdsAdapter implements AdPlatformInterface {
  private readonly logger = new Logger(TiktokAdsAdapter.name);

  async syncCampaigns(accountExternalId: string, _accessToken: string): Promise<CampaignSyncResult[]> {
    this.logger.warn(`[TikTokAds] syncCampaigns ${accountExternalId}: integración pendiente (Fase 2)`);
    return [];
  }

  async getCampaignMetrics(
    campaignExternalId: string,
    _accessToken: string,
    _dateFrom: Date,
    _dateTo: Date,
  ): Promise<DailyMetricData[]> {
    this.logger.warn(`[TikTokAds] getCampaignMetrics ${campaignExternalId}: integración pendiente (Fase 2)`);
    return [];
  }

  async pauseCampaign(campaignExternalId: string, _accessToken: string): Promise<void> {
    this.logger.warn(`[TikTokAds] pauseCampaign ${campaignExternalId}: integración pendiente (Fase 2) — sin efecto`);
  }

  async scaleBudget(campaignExternalId: string, _accessToken: string, _factor: number): Promise<void> {
    this.logger.warn(`[TikTokAds] scaleBudget ${campaignExternalId}: integración pendiente (Fase 2) — sin efecto`);
  }
}
