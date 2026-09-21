// marketing-backend/src/internal/internal.controller.ts
// Endpoints para grupojl-control (superadmin).
// Norte Triple Whale: ROAS agregado visible en Command Center y Organization View.
// Ref: .claude/contracts/superadmin-api.md — sección marketing-backend
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiSecurity }        from '@nestjs/swagger';
import { z }                           from 'zod';
import { InternalApiKeyGuard }         from './internal-api-key.guard.js';
import { PrismaService }               from '../prisma/prisma.service.js';
import { ZodValidationPipe }           from '../common/pipes/zod-validation.pipe.js';
import { MARKETING_THRESHOLDS }        from '../marketing.constants.js';

const ListCampaignsSchema = z.object({
  ecosystemId:    z.string().optional(),
  organizationId: z.string().optional(),
  platform:       z.enum(['META', 'GOOGLE', 'TIKTOK']).optional(),
  status:         z.enum(['ACTIVE', 'PAUSED', 'DELETED']).optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().min(1).max(100).default(50),
});
type ListCampaignsDto = z.infer<typeof ListCampaignsSchema>;

const ListAdAccountsSchema = z.object({
  ecosystemId:    z.string().optional(),
  organizationId: z.string().optional(),
});
type ListAdAccountsDto = z.infer<typeof ListAdAccountsSchema>;

const AttributionSchema = z.object({
  ecosystemId:    z.string(),
  organizationId: z.string().optional(),
  from:           z.string().datetime().optional(),
  to:             z.string().datetime().optional(),
  page:           z.coerce.number().int().positive().default(1),
  limit:          z.coerce.number().int().min(1).max(100).default(50),
});
type AttributionDto = z.infer<typeof AttributionSchema>;

const MetricsSummarySchema = z.object({
  ecosystemId:    z.string(),
  organizationId: z.string().optional(),
  from:           z.string().datetime().optional(),
  to:             z.string().datetime().optional(),
});
type MetricsSummaryDto = z.infer<typeof MetricsSummarySchema>;

@ApiTags('internal')
@ApiSecurity('internal-api-key')
@UseGuards(InternalApiKeyGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('campaigns')
  async listCampaigns(@Query(new ZodValidationPipe(ListCampaignsSchema)) dto: ListCampaignsDto) {
    const { ecosystemId, organizationId, platform, status, page, limit } = dto;
    const skip  = (page - 1) * limit;
    const where = {
      ...(ecosystemId    && { ecosystemId }),
      ...(organizationId && { organizationId }),
      ...(platform       && { platform }),
      ...(status         && { status }),
    };
    const [items, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where, skip, take: limit, orderBy: { updatedAt: 'desc' },
        select: {
          id: true, ecosystemId: true, organizationId: true,
          name: true, platform: true, status: true, dailyBudget: true,
          adAccount: { select: { name: true, lastSyncAt: true } },
        },
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return this.prisma.campaign.findUniqueOrThrow({
      where: { id },
      include: {
        adAccount:       { select: { name: true, platform: true, status: true } },
        automationRules: { where: { isActive: true } },
        dailyMetrics:    { where: { date: { gte: thirtyDaysAgo } }, orderBy: { date: 'desc' } },
      },
    });
  }

  @Get('ad-accounts')
  listAdAccounts(@Query(new ZodValidationPipe(ListAdAccountsSchema)) dto: ListAdAccountsDto) {
    return this.prisma.adAccount.findMany({
      where: {
        ...(dto.ecosystemId    && { ecosystemId:    dto.ecosystemId }),
        ...(dto.organizationId && { organizationId: dto.organizationId }),
      },
      // accessToken NUNCA se selecciona — invariante de dominio #3
      select: {
        id: true, ecosystemId: true, organizationId: true,
        platform: true, name: true, status: true, lastSyncAt: true, externalId: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  @Get('attribution')
  async listAttribution(@Query(new ZodValidationPipe(AttributionSchema)) dto: AttributionDto) {
    const { ecosystemId, organizationId, from, to, page, limit } = dto;
    const skip = (page - 1) * limit;
    const where = {
      ecosystemId,
      ...(organizationId && { organizationId }),
      ...((from || to) && { attributedAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.attributionEvent.findMany({ where, skip, take: limit, orderBy: { attributedAt: 'desc' } }),
      this.prisma.attributionEvent.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // Blended ROAS + channel ROAS — norte Triple Whale + Northbeam
  @Get('metrics/summary')
  async getMetricsSummary(@Query(new ZodValidationPipe(MetricsSummarySchema)) dto: MetricsSummaryDto) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const from = dto.from ? new Date(dto.from) : thirtyDaysAgo;
    const to   = dto.to   ? new Date(dto.to)   : new Date();

    const campaignWhere = {
      ecosystemId: dto.ecosystemId,
      ...(dto.organizationId && { organizationId: dto.organizationId }),
    };

    const [metricsByCampaign, campaigns] = await Promise.all([
      this.prisma.dailyMetric.groupBy({
        by: ['campaignId'],
        where: { date: { gte: from, lte: to }, campaign: campaignWhere },
        _sum: { spend: true, revenue: true, conversions: true, clicks: true, impressions: true },
      }),
      this.prisma.campaign.findMany({ where: campaignWhere, select: { id: true, platform: true } }),
    ]);

    const platformByCampaign = new Map(campaigns.map(c => [c.id, c.platform]));
    const byPlatform = new Map<string, { spend: number; revenue: number; conversions: number }>();
    let totalSpend = 0, totalRevenue = 0, totalConversions = 0;

    for (const row of metricsByPlatform) {
      const platform = platformByCampaign.get(row.campaignId) ?? 'UNKNOWN';
      const spend    = Number(row._sum.spend    ?? 0);
      const revenue  = Number(row._sum.revenue  ?? 0);
      const conv     = row._sum.conversions     ?? 0;
      totalSpend += spend; totalRevenue += revenue; totalConversions += conv;
      const ex = byPlatform.get(platform) ?? { spend: 0, revenue: 0, conversions: 0 };
      byPlatform.set(platform, { spend: ex.spend + spend, revenue: ex.revenue + revenue, conversions: ex.conversions + conv });
    }

    const blendedRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const roasAlert = blendedRoas < MARKETING_THRESHOLDS.ROAS_CRITICAL && totalSpend > 0
      ? { level: 'HIGH',    message: `ROAS crítico: ${blendedRoas.toFixed(2)}x — debajo de 1.0` }
      : blendedRoas < MARKETING_THRESHOLDS.ROAS_WARNING && totalSpend > 0
      ? { level: 'WARNING', message: `ROAS bajo: ${blendedRoas.toFixed(2)}x — debajo de 1.5` }
      : null;

    return {
      period:           { from: from.toISOString(), to: to.toISOString() },
      totalSpend:       totalSpend.toFixed(2),
      totalRevenue:     totalRevenue.toFixed(2),
      totalConversions,
      roas:             blendedRoas.toFixed(4),
      roasAlert,
      byPlatform: Array.from(byPlatform.entries()).map(([platform, d]) => ({
        platform,
        spend:       d.spend.toFixed(2),
        revenue:     d.revenue.toFixed(2),
        conversions: d.conversions,
        roas:        d.spend > 0 ? (d.revenue / d.spend).toFixed(4) : '0.0000',
      })),
    };
  }
}
