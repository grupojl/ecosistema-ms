#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
ok() { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

write_health() {
  local SVC="$1"
  local PORT="$2"
  mkdir -p "$ROOT/$SVC/src/health"
  cat > "$ROOT/$SVC/src/health/health.controller.ts" << 'EOF'
import { Controller, Get }                          from '@nestjs/common';
import { SetMetadata }                              from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthCheckResult, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService }  from '../prisma/prisma.service.js';

const Public = () => SetMetadata('isPublic', true);

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' as const } };
        } catch (e: unknown) {
          return { database: { status: 'down' as const, error: String(e) } };
        }
      },
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
EOF
  ok "$SVC/src/health/health.controller.ts"
}

write_health "notificaciones-backend" 3002
write_health "analytics-backend"      3003
write_health "workers-backend"        3004

echo ""
ok "Listo — make g → push → Railway redeploy"