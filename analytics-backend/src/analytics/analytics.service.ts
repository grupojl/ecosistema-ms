import { Injectable, Logger, Inject } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { PrismaService } from "../prisma/prisma.service.js";
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  constructor(private readonly prisma: PrismaService, @Inject(CACHE_MANAGER) private readonly cache: Cache) {}
  async getOverview(params: { ecosystemId:string; organizationId:string; from:Date; to:Date }) {
    const key = `analytics:overview:${params.organizationId}:${params.from.toISOString()}:${params.to.toISOString()}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;
    const where = (eventType: string) => ({ organizationId: params.organizationId, eventType, occurredAt: { gte: params.from, lte: params.to } });
    const [total, resolved, escalated, messages] = await Promise.all([
      this.prisma.analyticsEvent.count({ where: where("conversation.created") }),
      this.prisma.analyticsEvent.count({ where: where("conversation.resolved") }),
      this.prisma.analyticsEvent.count({ where: where("conversation.escalated") }),
      this.prisma.analyticsEvent.count({ where: where("message.sent") }),
    ]);
    const result = { totalConversations: total, resolvedConversations: resolved, escalatedConversations: escalated, totalMessages: messages };
    await this.cache.set(key, result);
    return result;
  }
  async getConversationsByDay(organizationId: string, from: Date, to: Date) {
    const summaries = await this.prisma.dailyConversationSummary.findMany({ where: { organizationId, date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
    if (summaries.length > 0) return summaries.map(s => ({ date: s.date.toISOString().split("T")[0], total: s.total, resolved: s.resolved }));
    const rows = await this.prisma.$queryRaw<{ date:string; total:bigint }[]>`
      SELECT TO_CHAR(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date, COUNT(*) AS total
      FROM "AnalyticsEvent"
      WHERE organization_id=${organizationId} AND event_type='conversation.created' AND occurred_at BETWEEN ${from} AND ${to}
      GROUP BY date ORDER BY date ASC`;
    return rows.map(r => ({ date: r.date, total: Number(r.total), resolved: 0 }));
  }
  async persistEvent(data: { ecosystemId:string; organizationId:string; eventType:string; payload:unknown; occurredAt:Date }) {
    return this.prisma.analyticsEvent.create({ data: { ecosystemId: data.ecosystemId, organizationId: data.organizationId, eventType: data.eventType, payload: data.payload as any, occurredAt: data.occurredAt } });
  }
}
