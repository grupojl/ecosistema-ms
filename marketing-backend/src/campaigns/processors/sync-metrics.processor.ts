// Queue: campaign-sync | Job: sync-platform-metrics
// Norte Triple Whale: revenue = AttributionEvents (honesto), NO el revenue de Meta (inflado).
// Degradación elegante: un adapter fallido no bloquea los otros.
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject }                       from '@nestjs/common';
import { Job }                                  from 'bullmq';
import { PrismaService }                        from '../../prisma/prisma.service.js';
import { MARKETING_QUEUES }                     from '../../marketing.constants.js';
import { AD_PLATFORM_TOKENS }                   from '../../ad-accounts/adapters/ad-platform.interface.js';
import type { AdPlatformInterface }             from '../../ad-accounts/adapters/ad-platform.interface.js';
import type { AdPlatform }                      from '@prisma/client';

@Processor(MARKETING_QUEUES.CAMPAIGN_SYNC, { concurrency: 3 })
export class SyncMetricsProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncMetricsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AD_PLATFORM_TOKENS.META) private readonly metaAdapter: AdPlatformInterface,
  ) { super(); }

  async process(job: Job<{ ecosystemId: string; organizationId: string }>): Promise<void> {
    const { ecosystemId, organizationId } = job.data;
    const accounts = await this.prisma.adAccount.findMany({ where: { ecosystemId, organizationId, status: 'ACTIVE' } });

    for (const account of accounts) {
      try {
        const adapter = account.platform === 'META' ? this.metaAdapter : null;
        if (!adapter) { this.logger.warn(`No adapter for ${account.platform}`); continue; }

        const campaigns = await adapter.syncCampaigns(account.externalId, account.accessToken);
        for (const c of campaigns) {
          await this.prisma.campaign.upsert({
            where:  { externalId_adAccountId: { externalId: c.externalId, adAccountId: account.id } },
            create: { ecosystemId, organizationId, adAccountId: account.id, externalId: c.externalId, name: c.name, platform: account.platform, status: c.status, dailyBudget: c.dailyBudget, totalBudget: c.totalBudget },
            update: { name: c.name, status: c.status, dailyBudget: c.dailyBudget, totalBudget: c.totalBudget },
          });
        }

        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(0,0,0,0);
        const activeCampaigns = await this.prisma.campaign.findMany({ where: { adAccountId: account.id, status: 'ACTIVE' } });

        for (const campaign of activeCampaigns) {
          const metrics = await adapter.getCampaignMetrics(campaign.externalId, account.accessToken, yesterday, yesterday);
          for (const m of metrics) {
            // Revenue honesto: sumamos los AttributionEvents, no lo que reporta Meta
            const agg = await this.prisma.attributionEvent.aggregate({
              where: { campaignId: campaign.id, attributedAt: { gte: yesterday, lt: new Date(yesterday.getTime() + 86_400_000) } },
              _sum: { revenue: true },
            });
            const revenue = Number(agg._sum.revenue ?? 0);
            const roas    = m.spend > 0 ? revenue / m.spend : null;
            await this.prisma.dailyMetric.upsert({
              where:  { campaignId_date: { campaignId: campaign.id, date: m.date } },
              create: { campaignId: campaign.id, date: m.date, impressions: m.impressions, clicks: m.clicks, spend: m.spend, revenue, roas, reach: m.reach, frequency: m.reach && m.reach > 0 ? m.impressions / m.reach : null },
              update: { impressions: m.impressions, clicks: m.clicks, spend: m.spend, revenue, roas, reach: m.reach, frequency: m.reach && m.reach > 0 ? m.impressions / m.reach : null },
            });
          }
        }
        await this.prisma.adAccount.update({ where: { id: account.id }, data: { lastSyncAt: new Date() } });
      } catch (err: unknown) {
        this.logger.warn(`[${job.id}] Sync failed for ${account.id}: ${err instanceof Error ? err.message : err}`);
        await this.prisma.adAccount.update({ where: { id: account.id }, data: { status: 'ERROR' } }).catch(() => {});
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) { this.logger.error(`[${job.id}] failed: ${err.message}`); }
}
