import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prisma 7 (engineType = "client"): requiere driver adapter (igual que el resto de servicios).
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma conectado');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
