// workers-backend/src/jobs/processors/analytics-export.processor.ts
//
// A-3.2: Genera exportaciones de analytics en background.
// Recibe job de analytics-backend → consulta via gRPC → genera CSV/JSON → sube a Railway Volume.
// Límite: exportaciones > 100MB rechazadas con error descriptivo.
//
// Resultado en JobLog.result: { url, format, sizeBytes, rowCount }

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject }        from '@nestjs/common';
import { ClientGrpc }            from '@nestjs/microservices';
import type { Job }              from 'bullmq';
import { firstValueFrom }        from 'rxjs';
import { writeFile, mkdir }      from 'node:fs/promises';
import { join }                  from 'node:path';

import { JobsService } from '../jobs.service.js';

const EXPORT_QUEUE   = 'workers.analytics-export';
const MAX_SIZE_BYTES = 100 * 1_024 * 1_024; // 100MB
const OUTPUT_DIR     = process.env['EXPORT_OUTPUT_DIR'] ?? '/tmp/analytics-exports';

export interface ExportJobData {
  ecosystemId:    string;
  organizationId: string;
  from:           string; // ISO date string
  to:             string;
  format:         'csv' | 'json';
  reportType:     'overview' | 'conversations' | 'agents';
}

interface AnalyticsGrpcClient {
  getOverview(req: object):            { toPromise: () => Promise<Record<string, unknown>> };
  getConversationsByDay(req: object):  { toPromise: () => Promise<{ days: unknown[] }> };
  getAgentMetrics(req: object):        { toPromise: () => Promise<{ agents: unknown[]; total: number }> };
}

@Processor(EXPORT_QUEUE)
export class AnalyticsExportProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsExportProcessor.name);
  private analyticsClient!: AnalyticsGrpcClient;

  constructor(
    private readonly jobs: JobsService,
    @Inject('ANALYTICS_GRPC_CLIENT') private readonly grpc: ClientGrpc,
  ) {
    super();
  }

  onModuleInit(): void {
    this.analyticsClient = this.grpc.getService<AnalyticsGrpcClient>('AnalyticsService');
  }

  async process(job: Job<ExportJobData>): Promise<void> {
    const { ecosystemId, organizationId, from, to, format, reportType } = job.data;
    const startedAt = Date.now();

    this.logger.log(`[${job.id}] Export ${reportType} ${format} para org:${organizationId}`);

    await this.jobs.updateJobLog(job.id as string, {
      status:    'PROCESSING',
      startedAt: new Date(startedAt),
      attempts:  job.attemptsMade + 1,
    });

    try {
      // 1. Consultar datos via gRPC a analytics-backend
      const data = await this.fetchData(reportType, {
        ecosystemId, organizationId,
        fromUnix: Math.floor(new Date(from).getTime() / 1_000),
        toUnix:   Math.floor(new Date(to).getTime()   / 1_000),
      });

      // 2. Serializar
      const content   = format === 'csv' ? this.toCsv(data) : JSON.stringify(data, null, 2);
      const sizeBytes = Buffer.byteLength(content, 'utf8');

      if (sizeBytes > MAX_SIZE_BYTES) {
        throw new Error(
          `Exportación supera el límite de 100MB (${(sizeBytes / 1_024 / 1_024).toFixed(1)}MB). ` +
          'Reducir el rango de fechas o el tipo de reporte.',
        );
      }

      // 3. Persistir en Railway Volume (o /tmp en local)
      await mkdir(OUTPUT_DIR, { recursive: true });
      const fileName = `${organizationId}-${reportType}-${Date.now()}.${format}`;
      const filePath = join(OUTPUT_DIR, fileName);
      await writeFile(filePath, content, 'utf8');

      // 4. URL accesible — en Railway: montar volumen y exponer via HTTP estático
      // En local: path absoluto
      const url = process.env['EXPORT_BASE_URL']
        ? `${process.env['EXPORT_BASE_URL']}/${fileName}`
        : filePath;

      const rowCount   = Array.isArray(data) ? data.length : Object.keys(data).length;
      const durationMs = Date.now() - startedAt;

      await this.jobs.updateJobLog(job.id as string, {
        status:      'DONE',
        completedAt: new Date(),
        durationMs,
        result:      { url, format, sizeBytes, rowCount } as unknown as Record<string, unknown>,
      });

      this.logger.log(
        `[${job.id}] Export completado — ${fileName} (${(sizeBytes / 1_024).toFixed(1)}KB, ${rowCount} filas, ${durationMs}ms)`,
      );
    } catch (error: unknown) {
      const message    = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startedAt;

      await this.jobs.updateJobLog(job.id as string, {
        status:      'FAILED',
        completedAt: new Date(),
        durationMs,
        error:       message,
      });

      throw error;
    }
  }

  // ── Fetch data via gRPC ───────────────────────────────────────────────────

  private async fetchData(
    reportType: string,
    params: { ecosystemId: string; organizationId: string; fromUnix: number; toUnix: number },
  ): Promise<unknown[] | Record<string, unknown>> {
    switch (reportType) {
      case 'overview': {
        const result = await firstValueFrom(
          // @ts-expect-error rxjs interop
          this.analyticsClient.getOverview(params),
        ) as Record<string, unknown>;
        return [result]; // overview es un objeto — lo envolvemos en array para CSV
      }

      case 'conversations': {
        const result = await firstValueFrom(
          // @ts-expect-error rxjs interop
          this.analyticsClient.getConversationsByDay(params),
        ) as { days: unknown[] };
        return result.days ?? [];
      }

      case 'agents': {
        // Paginar hasta traer todos los agentes
        const allAgents: unknown[] = [];
        let page = 1;
        while (true) {
          const result = await firstValueFrom(
            // @ts-expect-error rxjs interop
            this.analyticsClient.getAgentMetrics({ ...params, page, limit: 100 }),
          ) as { agents: unknown[]; total: number };
          allAgents.push(...result.agents);
          if (allAgents.length >= result.total) break;
          page++;
        }
        return allAgents;
      }

      default:
        throw new Error(`Tipo de reporte desconocido: ${reportType}`);
    }
  }

  // ── CSV serializer mínimo ─────────────────────────────────────────────────

  private toCsv(data: unknown[] | Record<string, unknown>): string {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return '';

    const headers = Object.keys(rows[0] as Record<string, unknown>);
    const lines   = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => {
          const val = (row as Record<string, unknown>)[h];
          const str = val === null || val === undefined ? '' : String(val);
          // Escapar comas y comillas
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','),
      ),
    ];

    return lines.join('\n');
  }
}
