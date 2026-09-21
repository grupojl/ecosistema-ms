// Queue: campaign-automation | Job: check-automation-rules
// Norte Motion: reglas en lenguaje humano, log visible, acción con confirmación.
// Invariante: una regla no corre más de 1 vez por windowDays (lastRunAt guard).
// Norte Northbeam: no evaluar sobre datos incompletos (< windowDays de métricas).
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Inject }                       from '@nestjs/common';
import { Job }                                  from 'bullmq';
import { PrismaService }                        from '../../prisma/prisma.service.js';
import { MARKETING_QUEUES }                     from '../../marketing.constants.js';
import { AD_PLATFORM_TOKENS }                   from '../../ad-accounts/adapters/ad-platform.interface.js';
import type { AdPlatformInterface }             from '../../ad-accounts/adapters/ad-platform.interface.js';
import type { AutomationRule, AdPlatform }      from '@prisma/client';

type RuleCondition = { metric: 'roas'|'ctr'|'cpc'|'spend'|'conversions'; operator: 'lt'|'gt'|'lte'|'gte'; value: number; windowDays: number };
type RuleAction    = { type: 'pause'|'scale_budget'|'notify'; factor?: number };

@Processor(MARKETING_QUEUES.CAMPAIGN_AUTOMATION, { concurrency: 2 })
export class AutomationCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(AutomationCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AD_PLATFORM_TOKENS.META) private readonly metaAdapter: AdPlatformInterface,
  ) { super(); }

  async process(job: Job<{ ecosystemId: string; organizationId: string }>): Promise<void> {
    const { ecosystemId, organizationId } = job.data;
    const rules = await this.prisma.automationRule.findMany({
      where: { isActive: true, campaign: { ecosystemId, organizationId, status: 'ACTIVE' } },
      include: { campaign: { include: { adAccount: true } } },
    });
    for (const rule of rules) {
      try { await this.evaluateRule(rule as any, job.id as string); }
      catch (err: unknown) { this.logger.warn(`Rule ${rule.id} failed: ${err instanceof Error ? err.message : err}`); }
    }
  }

  private async evaluateRule(rule: AutomationRule & { campaign: any }, jobId: string): Promise<void> {
    const condition = rule.condition as unknown as RuleCondition;
    const action    = rule.action    as unknown as RuleAction;

    if (rule.lastRunAt) {
      const nextRun = new Date(rule.lastRunAt);
      nextRun.setDate(nextRun.getDate() + condition.windowDays);
      if (new Date() < nextRun) return;
    }

    const from = new Date(); from.setDate(from.getDate() - condition.windowDays);
    const metrics = await this.prisma.dailyMetric.findMany({ where: { campaignId: rule.campaignId, date: { gte: from } }, orderBy: { date: 'desc' }, take: condition.windowDays });
    if (metrics.length < condition.windowDays) return; // datos insuficientes

    const avg = this.calcAvg(metrics, condition.metric);
    if (!this.evalCondition(avg, condition.operator, condition.value)) return;

    let success = false; let errorMessage: string | undefined;
    try { await this.execAction(rule.campaign, action); success = true; }
    catch (err: unknown) { errorMessage = err instanceof Error ? err.message : String(err); }

    await this.prisma.automationActionLog.create({
      data: {
        automationRuleId: rule.id, campaignId: rule.campaignId,
        organizationId:   rule.campaign.organizationId,
        actionType: action.type === 'pause' ? 'PAUSE' : action.type === 'scale_budget' ? 'SCALE_BUDGET' : 'NOTIFY',
        triggerSnapshot: { metric: condition.metric, value: avg, threshold: condition.value, windowDays: condition.windowDays },
        success, errorMessage,
      },
    });
    await this.prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date() } });
    this.logger.log(`Rule ${rule.id} executed — ${action.type} success:${success}`);
  }

  private calcAvg(metrics: any[], metric: RuleCondition['metric']): number {
    const vals = metrics.map(m => {
      switch (metric) {
        case 'roas':        return Number(m.roas ?? 0);
        case 'spend':       return Number(m.spend ?? 0);
        case 'conversions': return m.conversions;
        case 'ctr':         return Number(m.impressions) > 0 ? Number(m.clicks) / Number(m.impressions) : 0;
        case 'cpc':         return Number(m.clicks) > 0 ? Number(m.spend) / Number(m.clicks) : 0;
      }
    });
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  private evalCondition(v: number, op: RuleCondition['operator'], t: number): boolean {
    return op === 'lt' ? v < t : op === 'gt' ? v > t : op === 'lte' ? v <= t : v >= t;
  }

  private async execAction(campaign: any, action: RuleAction): Promise<void> {
    const adapter = campaign.platform === 'META' ? this.metaAdapter : null;
    if (!adapter) { this.logger.warn(`No adapter for ${campaign.platform}`); return; }
    if (action.type === 'pause')        await adapter.pauseCampaign(campaign.externalId, campaign.adAccount.accessToken);
    if (action.type === 'scale_budget') await adapter.scaleBudget(campaign.externalId, campaign.adAccount.accessToken, action.factor ?? 1.2);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) { this.logger.error(`[${job.id}] failed: ${err.message}`); }
}
