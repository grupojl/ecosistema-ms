// MetaAdsAdapter — Meta Graph API v19.0
// Degradación elegante: falla silenciosa, log warn, retorna vacío.
// Norte Triple Whale: solo sincronizamos spend/clicks/impressions — NO revenue de Meta (inflado).
// TODO(cb): migrar a opossum igual que chatia-backend/pasarelapagos-backend (Fase 2)
import { Injectable, Logger } from '@nestjs/common';
import axios                   from 'axios';
import type { AdPlatformInterface, CampaignSyncResult, DailyMetricData } from './ad-platform.interface.js';

const META_GRAPH_API = 'https://graph.facebook.com/v19.0';

@Injectable()
export class MetaAdsAdapter implements AdPlatformInterface {
  private readonly logger = new Logger(MetaAdsAdapter.name);

  async syncCampaigns(accountExternalId: string, accessToken: string): Promise<CampaignSyncResult[]> {
    try {
      const { data } = await axios.get(`${META_GRAPH_API}/act_${accountExternalId}/campaigns`, {
        params: { access_token: accessToken, fields: 'id,name,status,daily_budget,lifetime_budget', limit: 200 },
        timeout: 10_000,
      });
      return (data.data as Array<Record<string, unknown>>).map(c => ({
        externalId:  String(c['id']),
        name:        String(c['name']),
        status:      this.mapStatus(String(c['status'])),
        dailyBudget: c['daily_budget']    ? Number(c['daily_budget'])    / 100 : null,
        totalBudget: c['lifetime_budget'] ? Number(c['lifetime_budget']) / 100 : null,
      }));
    } catch (err: unknown) {
      this.logger.warn(`[MetaAds] syncCampaigns ${accountExternalId}: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  async getCampaignMetrics(campaignExternalId: string, accessToken: string, dateFrom: Date, dateTo: Date): Promise<DailyMetricData[]> {
    try {
      const { data } = await axios.get(`${META_GRAPH_API}/${campaignExternalId}/insights`, {
        params: {
          access_token: accessToken,
          fields: 'date_start,impressions,clicks,spend,reach',
          time_increment: 1,
          time_range: JSON.stringify({ since: this.fmt(dateFrom), until: this.fmt(dateTo) }),
        },
        timeout: 15_000,
      });
      return (data.data as Array<Record<string, unknown>>).map(row => ({
        externalCampaignId: campaignExternalId,
        date:        new Date(String(row['date_start'])),
        impressions: parseInt(String(row['impressions'] ?? '0'), 10),
        clicks:      parseInt(String(row['clicks']      ?? '0'), 10),
        spend:       parseFloat(String(row['spend']     ?? '0')),
        reach:       row['reach'] ? parseInt(String(row['reach']), 10) : undefined,
      }));
    } catch (err: unknown) {
      this.logger.warn(`[MetaAds] getCampaignMetrics ${campaignExternalId}: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  async pauseCampaign(campaignExternalId: string, accessToken: string): Promise<void> {
    await axios.post(`${META_GRAPH_API}/${campaignExternalId}`, { status: 'PAUSED', access_token: accessToken }, { timeout: 10_000 });
    this.logger.log(`[MetaAds] Paused ${campaignExternalId}`);
  }

  async scaleBudget(campaignExternalId: string, accessToken: string, factor: number): Promise<void> {
    const { data } = await axios.get(`${META_GRAPH_API}/${campaignExternalId}`, {
      params: { access_token: accessToken, fields: 'daily_budget' }, timeout: 10_000,
    });
    const newBudget = Math.round(Number(data.daily_budget ?? 0) * factor);
    await axios.post(`${META_GRAPH_API}/${campaignExternalId}`, { daily_budget: newBudget, access_token: accessToken }, { timeout: 10_000 });
    this.logger.log(`[MetaAds] Scaled ${campaignExternalId} x${factor} → ${newBudget / 100}`);
  }

  private mapStatus(s: string): 'ACTIVE' | 'PAUSED' | 'DELETED' {
    if (s === 'ACTIVE') return 'ACTIVE';
    if (s === 'PAUSED') return 'PAUSED';
    return 'DELETED';
  }
  private fmt(d: Date): string { return d.toISOString().split('T')[0] as string; }
}
