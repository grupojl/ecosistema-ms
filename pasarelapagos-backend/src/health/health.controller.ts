// pasarelapagos-backend/src/health/health.controller.ts
// DT-031: HealthController real — SELECT 1 a DB y PING a Redis.
// El check hardcodeado anterior devolvía 200 aunque la DB estuviera caída.
import { Controller, Get }  from '@nestjs/common';
import { ApiTags }           from '@nestjs/swagger';
import { PrismaService }     from '../modules/prisma/prisma.service';
import { RedisService }      from '../modules/redis/redis.service';

interface DependencyHealth {
  status:    'up' | 'down';
  latencyMs: number;
}

interface HealthResponse {
  status:    'ok' | 'degraded';
  service:   string;
  db:        DependencyHealth;
  redis:     DependencyHealth;
  uptime:    number;
  timestamp: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis:  RedisService,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const [db, redis] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
    ]);

    const status: 'ok' | 'degraded' =
      db.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded';

    return {
      status,
      service:   'pasarelapagos-backend',
      db,
      redis,
      uptime:    Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDb(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: Date.now() - start };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const start = Date.now();
    try {
      const pong = await this.redis.ping();
      return {
        status:    pong === 'PONG' ? 'up' : 'down',
        latencyMs: Date.now() - start,
      };
    } catch {
      return { status: 'down', latencyMs: Date.now() - start };
    }
  }
}
