#!/usr/bin/env bash
# =============================================================================
# x.sh — Fix errores de build (sin tocar Prisma — ya resuelto manualmente)
# Ejecutar: bash x.sh   ó   make x
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'
log() { echo -e "${CYAN}[x]${NC} $*"; }
ok()  { echo -e "${GREEN}[OK]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde raíz de ecosistema-ms/"; exit 1; }

# =============================================================================
# FIX 1 — packages/proto/src/index.ts — import.meta → path.join + __dirname
# =============================================================================
log "[1/6] packages/proto/src/index.ts — fix import.meta"

cat > "$ROOT/packages/proto/src/index.ts" << 'EOF'
// packages/proto/src/index.ts
// Compatible con NodeNext/CJS — NO usa import.meta
import { join } from 'path';

const PROTO_DIR = join(__dirname, '..', 'proto');

export const CHATIA_PROTO_PATH    = join(PROTO_DIR, 'chatia.proto');
export const NOTIF_PROTO_PATH     = join(PROTO_DIR, 'notificaciones.proto');
export const ANALYTICS_PROTO_PATH = join(PROTO_DIR, 'analytics.proto');
export const WORKERS_PROTO_PATH   = join(PROTO_DIR, 'workers.proto');
export const PAGOS_PROTO_PATH     = join(PROTO_DIR, 'pagos.proto');

export const CHATIA_PACKAGE    = 'chatia';
export const NOTIF_PACKAGE     = 'notificaciones';
export const ANALYTICS_PACKAGE = 'analytics';
export const WORKERS_PACKAGE   = 'workers';
export const PAGOS_PACKAGE     = 'pagos';
EOF
ok "packages/proto/src/index.ts"

# =============================================================================
# FIX 2 — workers-backend: dlq.module.ts — nombres de constantes correctos
# El módulo usaba FAQ_INGEST_DLQ pero en jobs.constants.ts se llama DLQ_FAQ_INGEST
# =============================================================================
log "[2/6] workers-backend/src/dlq/dlq.module.ts — fix nombres de constantes"

cat > "$ROOT/workers-backend/src/dlq/dlq.module.ts" << 'EOF'
// workers-backend/src/dlq/dlq.module.ts
import { Module }          from '@nestjs/common';
import { BullModule }      from '@nestjs/bullmq';
import { WORKER_QUEUES }   from '../jobs/jobs.constants.js';
import { DlqController }   from './dlq.controller.js';
import { DlqService }      from './dlq.service.js';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: WORKER_QUEUES.DLQ_FAQ_INGEST },
      { name: WORKER_QUEUES.DLQ_VECTOR_INDEX },
      { name: WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL },
    ),
  ],
  controllers: [DlqController],
  providers:   [DlqService],
  exports:     [DlqService],
})
export class DlqModule {}
EOF
ok "workers-backend/src/dlq/dlq.module.ts"

# =============================================================================
# FIX 3 — workers-backend: dlq.service.ts — tipos explícitos (no `never`)
#          + jobLog sin Prisma issues (ya resuelto, solo los tipos de TS)
# =============================================================================
log "[3/6] workers-backend/src/dlq/dlq.service.ts — fix tipos TS"

cat > "$ROOT/workers-backend/src/dlq/dlq.service.ts" << 'EOF'
// workers-backend/src/dlq/dlq.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue }                           from '@nestjs/bullmq';
import { Queue }                                 from 'bullmq';
import { PrismaService }                         from '../prisma/prisma.service.js';
import { WORKER_QUEUES }                         from '../jobs/jobs.constants.js';

const DLQ_WARN_THRESHOLD = 500;
const DLQ_MAX_THRESHOLD  = 1_000;

interface DlqJobEntry {
  queue:        string;
  jobId:        string;
  failedReason: string;
  attempts:     number;
  failedAt:     number;
  data:         unknown;
}

interface QueueStats {
  queue:    string;
  failed:   number;
  warning:  boolean;
  critical: boolean;
}

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    @InjectQueue(WORKER_QUEUES.DLQ_FAQ_INGEST)     private readonly faqDlq:      Queue,
    @InjectQueue(WORKER_QUEUES.DLQ_VECTOR_INDEX)   private readonly vectorDlq:   Queue,
    @InjectQueue(WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL) private readonly campaignDlq: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async listAll(): Promise<DlqJobEntry[]> {
    const results: DlqJobEntry[] = [];

    for (const [queueName, queue] of this.getQueues()) {
      const failed = await queue.getFailed(0, 99);
      for (const job of failed) {
        results.push({
          queue:        queueName,
          jobId:        job.id as string,
          failedReason: job.failedReason ?? 'unknown',
          attempts:     job.attemptsMade,
          failedAt:     job.finishedOn ?? 0,
          data:         job.data,
        });
      }
    }

    return results.sort((a, b) => b.failedAt - a.failedAt);
  }

  async retryJob(queueName: string, jobId: string): Promise<{ success: boolean }> {
    const queue = this.resolveQueue(queueName);
    const job   = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} no encontrado en ${queueName}`);

    await job.retry('failed');
    this.logger.log(`DLQ retry: job ${jobId} en ${queueName}`);

    await this.prisma.jobLog.updateMany({
      where: { jobId },
      data:  { status: 'PENDING', error: null },
    });

    return { success: true };
  }

  async discardJob(queueName: string, jobId: string): Promise<{ success: boolean }> {
    const queue = this.resolveQueue(queueName);
    const job   = await queue.getJob(jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} no encontrado en ${queueName}`);

    await job.remove();
    this.logger.log(`DLQ discard: job ${jobId} eliminado de ${queueName}`);

    await this.prisma.jobLog.updateMany({
      where: { jobId },
      data:  { status: 'CANCELLED', error: 'Descartado manualmente desde DLQ' },
    });

    return { success: true };
  }

  async getStats(): Promise<{ queues: QueueStats[]; totalFailed: number; healthy: boolean }> {
    const stats: QueueStats[] = [];
    let totalFailed = 0;

    for (const [queueName, queue] of this.getQueues()) {
      const failed  = await queue.getFailedCount();
      totalFailed  += failed;

      if (failed >= DLQ_WARN_THRESHOLD) {
        this.logger.warn(`DLQ ${queueName}: ${failed} jobs fallidos`);
      }
      if (failed >= DLQ_MAX_THRESHOLD) {
        this.logger.error(`DLQ ${queueName}: ${failed} jobs — CRÍTICO`);
      }

      stats.push({
        queue:    queueName,
        failed,
        warning:  failed >= DLQ_WARN_THRESHOLD,
        critical: failed >= DLQ_MAX_THRESHOLD,
      });
    }

    return { queues: stats, totalFailed, healthy: totalFailed < DLQ_WARN_THRESHOLD };
  }

  private getQueues(): Array<[string, Queue]> {
    return [
      [WORKER_QUEUES.DLQ_FAQ_INGEST,     this.faqDlq],
      [WORKER_QUEUES.DLQ_VECTOR_INDEX,   this.vectorDlq],
      [WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL, this.campaignDlq],
    ];
  }

  private resolveQueue(queueName: string): Queue {
    const map: Record<string, Queue> = {
      [WORKER_QUEUES.DLQ_FAQ_INGEST]:     this.faqDlq,
      [WORKER_QUEUES.DLQ_VECTOR_INDEX]:   this.vectorDlq,
      [WORKER_QUEUES.DLQ_CAMPAIGN_EMAIL]: this.campaignDlq,
    };
    const queue = map[queueName];
    if (!queue) throw new NotFoundException(`Queue ${queueName} no existe en DLQ`);
    return queue;
  }
}
EOF
ok "workers-backend/src/dlq/dlq.service.ts"

# =============================================================================
# FIX 4 — workers-backend: ClientGrpc → import type en los 3 processors
# =============================================================================
log "[4/6] workers-backend processors — import type ClientGrpc"

# analytics-export.processor.ts
sed -i "s|import { ClientGrpc }            from '@nestjs/microservices';|import type { ClientGrpc } from '@nestjs/microservices';|g" \
  "$ROOT/workers-backend/src/jobs/processors/analytics-export.processor.ts" 2>/dev/null || true

# campaign-email.processor.ts
sed -i "s|import { ClientGrpc }            from '@nestjs/microservices';|import type { ClientGrpc } from '@nestjs/microservices';|g" \
  "$ROOT/workers-backend/src/jobs/processors/campaign-email.processor.ts" 2>/dev/null || true

# vector-index.processor.ts
sed -i "s|import { ClientGrpc }            from '@nestjs/microservices';|import type { ClientGrpc } from '@nestjs/microservices';|g" \
  "$ROOT/workers-backend/src/jobs/processors/vector-index.processor.ts" 2>/dev/null || true

ok "import type ClientGrpc en los 3 processors de workers"

# =============================================================================
# FIX 5 — workers-backend: chunking.service.ts — quitar import de dto que no existe
#          FaqDocumentSource se define local en lugar de importar del dto
# =============================================================================
log "[5/6] workers-backend/src/jobs/services/chunking.service.ts — fix import faltante"

cat > "$ROOT/workers-backend/src/jobs/services/chunking.service.ts" << 'EOF'
// workers-backend/src/jobs/services/chunking.service.ts
import { Injectable, Logger } from '@nestjs/common';

// Definido localmente — evita dep circular con faq-ingest-job.dto
export type FaqDocumentSource = 'URL' | 'BASE64' | 'TEXT';

const CHUNK_SIZE    = 500;
const CHUNK_OVERLAP = 50;
const CHARS_PER_TOK = 4;

export interface TextChunk {
  content:    string;
  chunkIndex: number;
  tokenCount: number;
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  async extractAndChunk(
    content:   string,
    source:    FaqDocumentSource,
    fileName?: string,
  ): Promise<TextChunk[]> {
    const text = await this.extractText(content, source, fileName);
    return this.chunkText(text);
  }

  private async extractText(
    content:   string,
    source:    FaqDocumentSource,
    fileName?: string,
  ): Promise<string> {
    switch (source) {
      case 'TEXT': return content;
      case 'URL': {
        const res    = await fetch(content);
        if (!res.ok) throw new Error(`Error descargando ${content}: ${res.status}`);
        const ct     = res.headers.get('content-type') ?? '';
        const buffer = Buffer.from(await res.arrayBuffer());
        return this.extractFromBuffer(buffer, ct, fileName);
      }
      case 'BASE64': {
        const buffer = Buffer.from(content, 'base64');
        const ext    = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
        const ct     = ext === 'pdf'  ? 'application/pdf'
                     : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                     : 'text/plain';
        return this.extractFromBuffer(buffer, ct, fileName);
      }
      default: throw new Error(`Fuente no soportada: ${source as string}`);
    }
  }

  private async extractFromBuffer(
    buffer:    Buffer,
    mimeType:  string,
    fileName?: string,
  ): Promise<string> {
    if (mimeType.includes('pdf')) {
      try {
        // @ts-expect-error — pdf-parse puede no tener tipos en todos los entornos
        const pdfParse = (await import('pdf-parse')).default as (b: Buffer) => Promise<{ text: string }>;
        return (await pdfParse(buffer)).text;
      } catch {
        throw new Error('pdf-parse no instalado. Agregar a workers-backend/package.json');
      }
    }
    if (mimeType.includes('wordprocessingml') || (fileName ?? '').endsWith('.docx')) {
      try {
        // @ts-expect-error — mammoth puede no tener tipos en todos los entornos
        const mammoth = await import('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };
        return (await mammoth.extractRawText({ buffer })).value;
      } catch {
        throw new Error('mammoth no instalado. Agregar a workers-backend/package.json');
      }
    }
    return buffer.toString('utf-8');
  }

  private chunkText(text: string): TextChunk[] {
    const cleaned    = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];

    const chunkChars   = CHUNK_SIZE    * CHARS_PER_TOK;
    const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOK;
    const step         = chunkChars - overlapChars;
    const chunks: TextChunk[] = [];

    let i = 0;
    while (i < cleaned.length) {
      const content = cleaned.slice(i, i + chunkChars).trimEnd();
      const tokens  = Math.ceil(content.length / CHARS_PER_TOK);
      chunks.push({ content, chunkIndex: chunks.length, tokenCount: tokens });
      i += step;
    }

    this.logger.debug(`Chunking: ${cleaned.length} chars → ${chunks.length} chunks`);
    return chunks;
  }
}
EOF
ok "workers-backend/src/jobs/services/chunking.service.ts"

# =============================================================================
# FIX 6 — notificaciones-backend: grpc controller + dlq-monitor import type
# =============================================================================
log "[6/6] notificaciones-backend — fix tipos en grpc controller y dlq-monitor"

# grpc controller — fix retorno de enqueue
cat > "$ROOT/notificaciones-backend/src/grpc/notificaciones-grpc.controller.ts" << 'EOF'
// notificaciones-backend/src/grpc/notificaciones-grpc.controller.ts
import { Controller, Logger }    from '@nestjs/common';
import { GrpcMethod }            from '@nestjs/microservices';
import { PrismaService }         from '../prisma/prisma.service.js';
import { NotificationsService }  from '../notifications/notifications.service.js';

interface SendNotificationRequest {
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        number;
  templateKey:    string;
  idempotencyKey: string;
  payloadJson:    string;
}

interface UpdatePreferenceRequest {
  ecosystemId:    string;
  organizationId: string;
  contactId:      string;
  channel:        number;
  optedOut:       boolean;
}

const CHANNEL_MAP: Record<number, 'WHATSAPP' | 'EMAIL' | 'PUSH'> = {
  1: 'WHATSAPP', 2: 'EMAIL', 3: 'PUSH',
};

@Controller()
export class NotificacionesGrpcController {
  private readonly logger = new Logger(NotificacionesGrpcController.name);

  constructor(
    private readonly prisma:   PrismaService,
    private readonly notifSvc: NotificationsService,
  ) {}

  @GrpcMethod('NotificacionesService', 'SendNotification')
  async sendNotification(req: SendNotificationRequest) {
    const channel = CHANNEL_MAP[req.channel];
    if (!channel) {
      return { notificationId: '', status: 0, message: `Canal desconocido: ${req.channel}` };
    }
    try {
      const payload = JSON.parse(req.payloadJson) as Record<string, unknown>;
      // enqueue retorna { jobId, channel } — mapeamos al contrato gRPC
      const result  = await this.notifSvc.enqueue({
        ecosystemId:    req.ecosystemId,
        organizationId: req.organizationId,
        contactId:      req.contactId,
        channel,
        templateKey:    req.templateKey,
        idempotencyKey: req.idempotencyKey,
        payload,
      });
      return { notificationId: result.jobId, status: 2, message: 'queued' };
    } catch (e: unknown) {
      return { notificationId: '', status: 1, message: String(e) };
    }
  }

  @GrpcMethod('NotificacionesService', 'UpdateContactPreference')
  async updateContactPreference(req: UpdatePreferenceRequest) {
    const channel = CHANNEL_MAP[req.channel];
    if (!channel) return { success: false };
    try {
      await this.prisma.contactPreference.upsert({
        where: {
          organizationId_contactId_channel: {
            organizationId: req.organizationId,
            contactId:      req.contactId,
            channel,
          },
        },
        update: { optedOut: req.optedOut, optedOutAt: req.optedOut ? new Date() : null },
        create: {
          ecosystemId:    req.ecosystemId,
          organizationId: req.organizationId,
          contactId:      req.contactId,
          channel,
          optedOut:       req.optedOut,
          optedOutAt:     req.optedOut ? new Date() : null,
        },
      });
      return { success: true };
    } catch (e: unknown) {
      this.logger.error(`UpdatePreference error: ${String(e)}`);
      return { success: false };
    }
  }

  @GrpcMethod('NotificacionesService', 'Ping')
  ping(req: { from: string }) {
    return { pong: 'notificaciones-backend', timestampUnix: Date.now() };
  }
}
EOF
ok "notificaciones-grpc.controller.ts"

# dlq-monitor — import type ClientGrpc
sed -i "s|import { ClientGrpc }                                from '@nestjs/microservices';|import type { ClientGrpc } from '@nestjs/microservices';|g" \
  "$ROOT/notificaciones-backend/src/notifications/dlq/dlq-monitor.service.ts" 2>/dev/null || true
ok "dlq-monitor.service.ts — import type ClientGrpc"

# health controller — fix terminus v11 (sin PrismaHealthIndicator)
mkdir -p "$ROOT/notificaciones-backend/src/health"
cat > "$ROOT/notificaciones-backend/src/health/health.controller.ts" << 'EOF'
// notificaciones-backend/src/health/health.controller.ts
// @nestjs/terminus v11 — sin PrismaHealthIndicator
import { Controller, Get }                          from '@nestjs/common';
import { ApiTags }                                  from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthCheckResult, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService }  from '../prisma/prisma.service.js';
import { Public }         from '@ecosistema-ms/auth-server';

@ApiTags('health')
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

cat > "$ROOT/notificaciones-backend/src/health/health.module.ts" << 'EOF'
import { Module }           from '@nestjs/common';
import { TerminusModule }   from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaModule }     from '../prisma/prisma.module.js';

@Module({
  imports:     [TerminusModule, PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
EOF
ok "notificaciones-backend health controller terminus v11"

# Mismo fix health para analytics y workers
for SVC in analytics-backend workers-backend; do
  mkdir -p "$ROOT/$SVC/src/health"
  cat > "$ROOT/$SVC/src/health/health.controller.ts" << HEOF
// $SVC/src/health/health.controller.ts
import { Controller, Get }                          from '@nestjs/common';
import { ApiTags }                                  from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, HealthCheckResult, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService }  from '../prisma/prisma.service.js';
import { Public }         from '@ecosistema-ms/auth-server';

@ApiTags('health')
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
          await this.prisma.\$queryRaw\`SELECT 1\`;
          return { database: { status: 'up' as const } };
        } catch (e: unknown) {
          return { database: { status: 'down' as const, error: String(e) } };
        }
      },
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }
}
HEOF

  cat > "$ROOT/$SVC/src/health/health.module.ts" << HMODEOF
import { Module }           from '@nestjs/common';
import { TerminusModule }   from '@nestjs/terminus';
import { HealthController } from './health.controller.js';
import { PrismaModule }     from '../prisma/prisma.module.js';

@Module({
  imports:     [TerminusModule, PrismaModule],
  controllers: [HealthController],
})
export class HealthModule {}
HMODEOF
  ok "$SVC health controller terminus v11"
done

echo ""
ok "════════════════════════════════════════════════════════"
ok "  6 fixes aplicados"
ok "════════════════════════════════════════════════════════"
echo ""
echo "  [1] packages/proto/src/index.ts            — import.meta → __dirname"
echo "  [2] workers dlq.module.ts                  — nombres constantes DLQ correctos"
echo "  [3] workers dlq.service.ts                 — tipos explícitos DlqJobEntry/QueueStats"
echo "  [4] workers processors (3)                 — import type ClientGrpc"
echo "  [5] workers chunking.service.ts            — FaqDocumentSource local, sin import roto"
echo "  [6] notificaciones grpc/health/dlq-monitor — tipos correctos, terminus v11"
echo ""
echo "Próximo paso: make g → push → Railway redeploy"