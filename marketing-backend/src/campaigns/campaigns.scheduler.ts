// Dispara jobs de sync y automation via BullMQ (no directamente).
// Norte Triple Whale: sync cada 15 min. Automation check cada hora.
import { Injectable, Logger }     from '@nestjs/common';
import { Cron, CronExpression }   from '@nestjs/schedule';
import { InjectQueue }             from '@nestjs/bullmq';
import { Queue }                   from 'bullmq';
import { PrismaService }           from '../prisma/prisma.service.js';
import { MARKETING_QUEUES }        from '../marketing.constants.js';

@Injectable()
export class CampaignScheduler {
  private readonly logger = new Logger(CampaignScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MARKETING_QUEUES.CAMPAIGN_SYNC)       private readonly syncQueue: Queue,
    @InjectQueue(MARKETING_QUEUES.CAMPAIGN_AUTOMATION) private readonly autoQueue: Queue,
  ) {}

  @Cron('0 */15 * * * *')
  async scheduleSyncJobs(): Promise<void> {
    const orgs = await this.prisma.adAccount.findMany({
      where: { status: 'ACTIVE' }, select: { ecosystemId: true, organizationId: true }, distinct: ['ecosystemId', 'organizationId'],
    });
    for (const org of orgs) {
      await this.syncQueue.add('sync-platform-metrics', org,
        { jobId: `sync:${org.ecosystemId}:${org.organizationId}:${Date.now()}`, attempts: 2, backoff: { type: 'exponential', delay: 30_000 } },
      ).catch(e => this.logger.warn(`[Scheduler] sync enqueue failed: ${e.message}`));
    }
    if (orgs.length) this.logger.log(`[Scheduler] Enqueued sync for ${orgs.length} orgs`);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduleAutomationJobs(): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: { isActive: true }, select: { campaign: { select: { ecosystemId: true, organizationId: true } } }, distinct: ['campaignId'],
    });
    const uniqueOrgs = new Map(rules.map(r => [`${r.campaign.ecosystemId}:${r.campaign.organizationId}`, r.campaign]));
    for (const org of uniqueOrgs.values()) {
      await this.autoQueue.add('check-automation-rules', org,
        { jobId: `automation:${org.ecosystemId}:${org.organizationId}:${Date.now()}`, attempts: 2, backoff: { type: 'exponential', delay: 60_000 } },
      ).catch(e => this.logger.warn(`[Scheduler] automation enqueue failed: ${e.message}`));
    }
    if (uniqueOrgs.size) this.logger.log(`[Scheduler] Enqueued automation for ${uniqueOrgs.size} orgs`);
  }
}
