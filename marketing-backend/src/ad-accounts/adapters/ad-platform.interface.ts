// Contrato que Meta, Google y TikTok adapters implementan.
// Nunca exponer tipos del SDK del proveedor fuera del adapter.
export interface CampaignSyncResult {
  externalId: string; name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
  dailyBudget: number | null; totalBudget: number | null;
}
export interface DailyMetricData {
  externalCampaignId: string; date: Date;
  impressions: number; clicks: number; spend: number; reach?: number;
}
export interface AdPlatformInterface {
  syncCampaigns(accountExternalId: string, accessToken: string): Promise<CampaignSyncResult[]>;
  getCampaignMetrics(campaignExternalId: string, accessToken: string, dateFrom: Date, dateTo: Date): Promise<DailyMetricData[]>;
  pauseCampaign(campaignExternalId: string, accessToken: string): Promise<void>;
  scaleBudget(campaignExternalId: string, accessToken: string, factor: number): Promise<void>;
}
export const AD_PLATFORM_TOKENS = {
  META:   'META_ADS_ADAPTER',
  GOOGLE: 'GOOGLE_ADS_ADAPTER',
  TIKTOK: 'TIKTOK_ADS_ADAPTER',
} as const;
