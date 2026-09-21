import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService }                  from '../prisma/prisma.service.js';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(ecosystemId: string, organizationId: string) {
    return this.prisma.campaign.findMany({
      where: { ecosystemId, organizationId }, orderBy: { updatedAt: 'desc' },
      include: { adAccount: { select: { name: true, platform: true } } },
    });
  }

  async findOne(id: string, organizationId: string) {
    const c = await this.prisma.campaign.findFirst({
      where: { id, organizationId },
      include: { adAccount: { select: { name: true, platform: true } }, automationRules: { where: { isActive: true } } },
    });
    if (!c) throw new NotFoundException(`Campaign ${id} no encontrada`);
    return c;
  }

  async getMetrics(campaignId: string, organizationId: string) {
    await this.findOne(campaignId, organizationId);
    const from = new Date(); from.setDate(from.getDate() - 30);
    return this.prisma.dailyMetric.findMany({ where: { campaignId, date: { gte: from } }, orderBy: { date: 'desc' } });
  }

  // Norte Motion: máximo 5 métricas en el summary — ROAS, Spend, Conversiones, CTR, CPC
  async getMetricsSummary(campaignId: string, organizationId: string) {
    await this.findOne(campaignId, organizationId);
    const from = new Date(); from.setDate(from.getDate() - 30);
    const agg = await this.prisma.dailyMetric.aggregate({
      where: { campaignId, date: { gte: from } },
      _sum: { spend: true, revenue: true, conversions: true, clicks: true, impressions: true },
    });
    const spend = Number(agg._sum.spend ?? 0), revenue = Number(agg._sum.revenue ?? 0);
    const clicks = agg._sum.clicks ?? 0, impressions = agg._sum.impressions ?? 0;
    return {
      roas:        spend > 0       ? (revenue / spend).toFixed(4)        : '0.0000',
      spend:       spend.toFixed(2),
      conversions: agg._sum.conversions ?? 0,
      ctr:         impressions > 0 ? (clicks / impressions).toFixed(4)   : '0.0000',
      cpc:         clicks > 0      ? (spend / clicks).toFixed(2)         : '0.00',
    };
  }

  async getAutomationRules(campaignId: string, organizationId: string) {
    await this.findOne(campaignId, organizationId);
    return this.prisma.automationRule.findMany({ where: { campaignId } });
  }

  async createAutomationRule(campaignId: string, organizationId: string, data: { name: string; condition: unknown; action: unknown }) {
    await this.findOne(campaignId, organizationId);
    return this.prisma.automationRule.create({ data: { campaignId, name: data.name, condition: data.condition, action: data.action } });
  }

  async toggleAutomationRule(ruleId: string, organizationId: string, isActive: boolean) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id: ruleId, campaign: { organizationId } } });
    if (!rule) throw new NotFoundException(`AutomationRule ${ruleId} no encontrada`);
    return this.prisma.automationRule.update({ where: { id: ruleId }, data: { isActive } });
  }
}
