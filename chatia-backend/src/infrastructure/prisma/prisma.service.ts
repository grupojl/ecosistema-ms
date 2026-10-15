import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@/generated/prisma/client.js';
// Importa el adaptador de PostgreSQL
import { PrismaPg } from '@prisma/adapter-pg';
// Importa el driver pg (node-postgres)
import * as pg from 'pg';

const envInt = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: pg.Pool;

  constructor() {
    // Pool con límites explícitos: sin timeouts, una DB lenta deja requests colgados para siempre
    // y sin handler de 'error' un cliente inactivo que se cae tira abajo todo el proceso.
    const pool = new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
      max: envInt('DB_POOL_MAX', 10),
      connectionTimeoutMillis: envInt('DB_CONNECT_TIMEOUT_MS', 5_000),
      idleTimeoutMillis: envInt('DB_IDLE_TIMEOUT_MS', 30_000),
      statement_timeout: envInt('DB_STATEMENT_TIMEOUT_MS', 15_000),
    });

    super({ adapter: new PrismaPg(pool) });

    this.pool = pool;
    this.pool.on('error', (err: Error) =>
      this.logger.error(`Postgres (cliente inactivo): ${err.message}`),
    );
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end().catch(() => undefined);
  }
}
