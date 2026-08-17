// analytics-backend/src/analytics/projections/projections.service.ts
//
// A-3.1: Worker de proyecciones nocturnas.
// @Cron cada hora → recalcula DailyConversationSummary de los últimos 2 días.
// Lock distribuido en Redis → solo una instancia corre a la vez.
// FORCE_PROJECTION_RUN=true → corre inmediatamente en onModuleInit (para tests/debug).

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression }             from '@nestjs/schedule';
import { ConfigService }                    from '@nestjs/config';
import { PrismaService }                    from '../../prisma/prisma.service.js';
import { Redis }                            from 'ioredis';

const LOCK_KEY    = 'analytics:projections:lock';
const LOCK_TTL_S  = 3_600; // 1 hora — duración máxima del cron
const ROLLING_DAYS = 2;    // recalcular los últimos 2 días

@Injectable()
export class ProjectionsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectionsService.name);
  private readonly redis:  Redis;

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {
    this.redis = new Redis({
      host:     config.get<string>('REDIS_HOST', 'localhost'),
      port:     parseInt(config.get<string>('REDIS_PORT', '6379'), 10),
      password: config.get<string>('REDIS_PASSWORD'),
    });
  }

  async onModuleInit(): Promise<void> {
    const force = this.config.get<string>('FORCE_PROJECTION_RUN') === 'true';
    if (force) {
      this.logger.warn('FORCE_PROJECTION_RUN=true — ejecutando proyecciones al iniciar');
      await this.recalculateProjections();
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async recalculateProjections(): Promise<void> {
    // Intentar obtener lock distribuido con SET NX EX
    const acquired = await this.redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL_S, 'NX');
    if (!acquired) {
      this.logger.debug('Proyecciones: otra instancia ya está corriendo (lock activo)');
      return;
    }

    const startedAt = Date.now();
    this.logger.log('Proyecciones: iniciando recálculo de los últimos 2 días...');

    try {
      // Calcular ventana rolling
      const to   = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - ROLLING_DAYS);

      // Obtener organizaciones con eventos en el período
      const orgs = await this.prisma.analyticsEvent.findMany({
        where:   { occurredAt: { gte: from, lte: to } },
        select:  { organizationId: true, ecosystemId: true },
        distinct: ['organizationId'],
      });

      this.logger.log(`Proyecciones: procesando ${orgs.length} organizaciones`);

      for (const { organizationId, ecosystemId } of orgs) {
        await this.recalculateForOrg(organizationId, ecosystemId, from, to);
      }

      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Proyecciones completadas — ${orgs.length} orgs en ${durationMs}ms`,
      );
    } catch (error: unknown) {
      this.logger.error(`Error en proyecciones: ${String(error)}`);
    } finally {
      // Liberar lock
      await this.redis.del(LOCK_KEY);
    }
  }

  private async recalculateForOrg(
    organizationId: string,
    ecosystemId:    string,
    from:           Date,
    to:             Date,
  ): Promise<void> {
    // Iterar por días en el rango
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);

    while (current <= to) {
      const dayStart = new Date(current);
      const dayEnd   = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);

      // Obtener eventos del día para esta org
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          organizationId,
          occurredAt: { gte: dayStart, lte: dayEnd },
          eventType:  { in: ['conversation.created', 'conversation.resolved', 'conversation.escalated'] },
        },
        select: { eventType: true, payload: true },
      });

      // Agrupar por canal
      const byChannel = new Map<string, { total: number; resolved: number; escalated: number }>();

      for (const e of events) {
        const payload = e.payload as Record<string, unknown>;
        const channel = String(payload['channel'] ?? 'UNKNOWN');

        if (!byChannel.has(channel)) {
          byChannel.set(channel, { total: 0, resolved: 0, escalated: 0 });
        }

        const stats = byChannel.get(channel)!;
        if (e.eventType === 'conversation.created')   stats.total++;
        if (e.eventType === 'conversation.resolved')  stats.resolved++;
        if (e.eventType === 'conversation.escalated') stats.escalated++;
      }

      // Upsert proyecciones por canal
      for (const [channel, stats] of byChannel) {
        await this.prisma.dailyConversationSummary.upsert({
          where: {
            organizationId_date_channel: {
              organizationId,
              date:    dayStart,
              channel,
            },
          },
          update: {
            total:        stats.total,
            resolved:     stats.resolved,
            escalated:    stats.escalated,
            calculatedAt: new Date(),
          },
          create: {
            organizationId,
            ecosystemId,
            date:      dayStart,
            channel,
            total:     stats.total,
            resolved:  stats.resolved,
            escalated: stats.escalated,
          },
        });
      }

      current.setDate(current.getDate() + 1);
    }
  }
}
