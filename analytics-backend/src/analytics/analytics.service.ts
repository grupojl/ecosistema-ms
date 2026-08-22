// analytics-backend/src/analytics/analytics.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER }              from '@nestjs/cache-manager';
import type { Cache }                 from 'cache-manager';
import { PrismaService }              from '../prisma/prisma.service.js';

const CACHE_TTL_5MIN  = 5 * 60 * 1_000;
const CACHE_TTL_10MIN = 10 * 60 * 1_000;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getOverview(params: {
    ecosystemId:    string;
    organizationId: string;
    from:           Date;
    to:             Date;
  }) {
    const cacheKey = `analytics:overview:${params.organizationId}:${params.from.toISOString()}:${params.to.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const where = (eventType: string) => ({
      organizationId: params.organizationId,
      ecosystemId:    params.ecosystemId,
      eventType,
      occurredAt: { gte: params.from, lte: params.to },
    });

    const [total, resolved, escalated] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: where('conversation.created') }),
      this.prisma.analyticsEvent.count({ where: where('conversation.resolved') }),
      this.prisma.analyticsEvent.count({ where: where('conversation.escalated') }),
    ]);

    const result = { totalConversations: total, resolvedCount: resolved, escalatedCount: escalated };
    await this.cache.set(cacheKey, result, CACHE_TTL_5MIN);
    return result;
  }

  async getConversationsByDay(organizationId: string, from: Date, to: Date) {
    const cacheKey = `analytics:byDay:${organizationId}:${from.toISOString()}:${to.toISOString()}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const summaries = await this.prisma.dailyConversationSummary.findMany({
      where:   { organizationId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    let result;
    if (summaries.length > 0) {
      const byDate = new Map<string, { date: string; total: number; resolved: number; escalated: number }>();
      for (const s of summaries) {
        const dateStr = s.date.toISOString().substring(0, 10);
        const existing = byDate.get(dateStr) ?? { date: dateStr, total: 0, resolved: 0, escalated: 0 };
        byDate.set(dateStr, {
          date:      dateStr,
          total:     existing.total     + s.total,
          resolved:  existing.resolved  + s.resolved,
          escalated: existing.escalated + s.escalated,
        });
      }
      result = [...byDate.values()];
    } else {
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          organizationId,
          eventType: { in: ['conversation.created', 'conversation.resolved', 'conversation.escalated'] },
          occurredAt: { gte: from, lte: to },
        },
        select: { eventType: true, occurredAt: true },
        orderBy: { occurredAt: 'asc' },
      });

      const buckets = new Map<string, { date: string; total: number; resolved: number; escalated: number }>();
      for (const e of events) {
        const date = e.occurredAt.toISOString().substring(0, 10);
        const b = buckets.get(date) ?? { date, total: 0, resolved: 0, escalated: 0 };
        if (e.eventType === 'conversation.created')   b.total++;
        if (e.eventType === 'conversation.resolved')  b.resolved++;
        if (e.eventType === 'conversation.escalated') b.escalated++;
        buckets.set(date, b);
      }
      result = [...buckets.values()];
    }

    await this.cache.set(cacheKey, result, CACHE_TTL_5MIN);
    return result;
  }

  async getAgentMetrics(params: {
    ecosystemId:    string;
    organizationId: string;
    from:           Date;
    to:             Date;
    page?:          number;
    limit?:         number;
  }): Promise<{ agents: unknown[]; total: number }> {
    const { organizationId, ecosystemId, from, to } = params;
    const limit  = Math.min(params.limit  ?? 20, 100);
    const offset = ((params.page ?? 1) - 1) * limit;

    const cacheKey = `analytics:agents:${organizationId}:${from.toISOString()}:${to.toISOString()}:${offset}:${limit}`;
    const cached = await this.cache.get<{ agents: unknown[]; total: number }>(cacheKey);
    if (cached) return cached;

    const [assigned, resolved] = await Promise.all([
      this.prisma.analyticsEvent.findMany({
        where: { organizationId, ecosystemId, eventType: 'conversation.assigned', occurredAt: { gte: from, lte: to } },
        select: { payload: true },
        take: 50_000,
      }),
      this.prisma.analyticsEvent.findMany({
        where: { organizationId, ecosystemId, eventType: 'conversation.resolved_by_agent', occurredAt: { gte: from, lte: to } },
        select: { payload: true },
        take: 50_000,
      }),
    ]);

    const agentMap = new Map<string, { assigned: number; resolved: number }>();

    for (const e of assigned) {
      const p = e.payload as Record<string, unknown>;
      const agentId = String(p['agentId'] ?? '');
      if (!agentId) continue;
      const cur = agentMap.get(agentId) ?? { assigned: 0, resolved: 0 };
      agentMap.set(agentId, { ...cur, assigned: cur.assigned + 1 });
    }
    for (const e of resolved) {
      const p = e.payload as Record<string, unknown>;
      const agentId = String(p['agentId'] ?? '');
      if (!agentId) continue;
      const cur = agentMap.get(agentId) ?? { assigned: 0, resolved: 0 };
      agentMap.set(agentId, { ...cur, resolved: cur.resolved + 1 });
    }

    const all = [...agentMap.entries()]
      .map(([agentId, data]) => ({ agentId, ...data }))
      .sort((a, b) => b.assigned - a.assigned);

    const result = { agents: all.slice(offset, offset + limit), total: all.length };
    await this.cache.set(cacheKey, result, CACHE_TTL_10MIN);
    return result;
  }

  async persistEvent(data: {
    ecosystemId:    string;
    organizationId: string;
    eventType:      string;
    payload:        Record<string, unknown>;
    occurredAt:     Date;
  }): Promise<void> {
    await this.prisma.analyticsEvent.create({ data });
  }
}
