#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix: auth-server imports sin .js + workers app.module.ts roto
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# =============================================================================
# FIX 1 — packages/auth-server/src/index.ts
# Agregar .js a todos los imports relativos (ESM con module:nodenext lo requiere)
# =============================================================================
log "[1/2] packages/auth-server/src/index.ts — agregar .js a imports"

AUTH_INDEX="$ROOT/packages/auth-server/src/index.ts"
if [ -f "$AUTH_INDEX" ]; then
  # Reemplazar imports relativos sin .js: from './xxx' → from './xxx.js'
  # Solo para imports que no tienen ya extensión
  sed -i "s|from '\./\([^']*\)'|from './\1.js'|g" "$AUTH_INDEX"
  sed -i "s|from '\./\([^']*\)\.js\.js'|from './\1.js'|g" "$AUTH_INDEX"
  ok "auth-server/src/index.ts — .js agregado"
else
  log "auth-server/src/index.ts no encontrado, creando..."
  mkdir -p "$ROOT/packages/auth-server/src"
  cat > "$AUTH_INDEX" << 'EOF'
// packages/auth-server/src/index.ts
// Re-exports de guards, decorators y tipos para los microservicios
export * from './guards/tenant.guard.js';
export * from './guards/roles.guard.js';
export * from './decorators/public.decorator.js';
export * from './decorators/tenant.decorator.js';
export * from './decorators/roles.decorator.js';
export * from './types/tenant-context.js';
EOF
  ok "auth-server/src/index.ts creado con exports .js"
fi

# =============================================================================
# FIX 2 — workers-backend/src/app.module.ts
# El sed lo dejó con join() sueltos y sin las constantes de proto
# Reescribir completo y limpio
# =============================================================================
log "[2/2] workers-backend/src/app.module.ts — reescribir limpio"

cat > "$ROOT/workers-backend/src/app.module.ts" << 'EOF'
// workers-backend/src/app.module.ts
import { join }         from 'path';
import { Module }       from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule }   from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { PrismaModule }    from './prisma/prisma.module.js';
import { HealthModule }    from './health/health.module.js';
import { MetricsModule }   from './metrics/metrics.module.js';
import { JobsModule }      from './jobs/jobs.module.js';
import { DlqModule }       from './dlq/dlq.module.js';
import { GrpcModule }      from './grpc/grpc.module.js';
import { CampaignsModule } from './campaigns/campaigns.module.js';

const PROTO_DIR = join(process.cwd(), 'proto');

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host:     process.env['REDIS_HOST']     ?? 'localhost',
          port:     parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
          password: process.env['REDIS_PASSWORD'],
        },
      }),
    }),

    ClientsModule.register([
      {
        name:      'CHATIA_GRPC_CLIENT',
        transport: Transport.GRPC,
        options: {
          package:   'chatia',
          protoPath: join(PROTO_DIR, 'chatia.proto'),
          url: process.env['CHATIA_GRPC_URL'] ?? 'localhost:5001',
        },
      },
      {
        name:      'NOTIF_GRPC_CLIENT',
        transport: Transport.GRPC,
        options: {
          package:   'notificaciones',
          protoPath: join(PROTO_DIR, 'notificaciones.proto'),
          url: process.env['NOTIF_GRPC_URL'] ?? 'localhost:5003',
        },
      },
      {
        name:      'ANALYTICS_GRPC_CLIENT',
        transport: Transport.GRPC,
        options: {
          package:   'analytics',
          protoPath: join(PROTO_DIR, 'analytics.proto'),
          url: process.env['ANALYTICS_GRPC_URL'] ?? 'localhost:5004',
        },
      },
    ]),

    PrismaModule,
    MetricsModule,
    HealthModule,
    JobsModule,
    DlqModule,
    GrpcModule,
    CampaignsModule,
  ],
})
export class AppModule {}
EOF
ok "workers-backend/src/app.module.ts — reescrito limpio"

# =============================================================================
# FIX 3 — notificaciones dlq.module.ts — también quedó con join suelto
# =============================================================================
log "Fix dlq.module.ts de notificaciones"

cat > "$ROOT/notificaciones-backend/src/notifications/dlq/dlq.module.ts" << 'EOF'
// notificaciones-backend/src/notifications/dlq/dlq.module.ts
import { join }             from 'path';
import { Module }           from '@nestjs/common';
import { BullModule }       from '@nestjs/bullmq';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES }           from '../notifications.constants.js';
import { DlqMonitorService } from './dlq-monitor.service.js';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: QUEUES.DLQ }),
    ClientsModule.registerAsync([
      {
        name: 'CHATIA_GRPC_CLIENT',
        imports: [ConfigModule],
        inject:  [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package:   'chatia',
            protoPath: join(process.cwd(), 'proto', 'chatia.proto'),
            url: config.get<string>('CHATIA_GRPC_URL', 'localhost:5001'),
          },
        }),
      },
    ]),
  ],
  providers: [DlqMonitorService],
  exports:   [DlqMonitorService],
})
export class DlqModule {}
EOF
ok "notificaciones dlq.module.ts reescrito"

echo ""
ok "════════════════════════════════════════════════════════"
ok "  3 fixes aplicados"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  [1] auth-server/src/index.ts      — .js en imports relativos"
echo "  [2] workers app.module.ts         — reescrito limpio con join()"
echo "  [3] notificaciones dlq.module.ts  — reescrito limpio con join()"
echo ""
echo "Próximo: make g → push → Railway redeploy"