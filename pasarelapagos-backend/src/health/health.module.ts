// pasarelapagos-backend/src/health/health.module.ts
// DT-031: HealthModule inyecta PrismaService y RedisService (globales)
import { Module }          from '@nestjs/common';
import { HealthController } from './health.controller.js';

// PrismaModule y RedisModule son @Global() — HealthController los recibe automáticamente
@Module({ controllers: [HealthController] })
export class HealthModule {}
