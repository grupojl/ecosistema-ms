// src/core/privacy/retention.service.ts
//
// Privacidad de datos de ciudadanos:
//  1. Retención: borra sesiones del asistente (y, si se configura, mensajes) más viejos que el plazo.
//  2. Derecho de supresión: borra TODO lo de un contacto (conversaciones, mensajes, sesiones) a pedido del titular.
//
// Variables:  SESSION_RETENTION_DAYS (default 90) · MESSAGE_RETENTION_DAYS (default 0 = no borrar mensajes)
//             RETENTION_ENABLED=false para apagar el cron.
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CacheService } from '@/infrastructure/common/services/cache.service.js';
import {
  PRIVACY_REPOSITORY,
  type IPrivacyRepository,
} from '@/core/privacy/repository/privacy.repository.interface.js';

const BATCH = 1_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const envDays = (name: string, fallback: number): number => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export interface RetentionReport {
  sessionsDeleted: number;
  messagesDeleted: number;
}

export interface ErasureReport {
  contactId: string;
  conversationsDeleted: number;
  messagesDeleted: number;
  sessionsDeleted: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @Inject(PRIVACY_REPOSITORY) private readonly repo: IPrivacyRepository,
    @Optional() private readonly cache?: CacheService,
  ) {}

  /** Todos los días a las 03:00. Con varias réplicas, un lock en Redis hace que corra en una sola. */
  @Cron('0 3 * * *')
  async scheduledPurge(): Promise<void> {
    if (process.env['RETENTION_ENABLED'] === 'false') return;
    if (this.cache && !(await this.cache.tryLock('retention-purge', 6 * 3600)))
      return;
    try {
      const report = await this.purgeExpired();
      this.logger.log(
        `Retención: ${report.sessionsDeleted} sesiones y ${report.messagesDeleted} mensajes eliminados`,
      );
    } catch (err) {
      this.logger.error(
        `[ALERTA TÉCNICA] Falló la purga de retención: ${String(err)}`,
      );
    }
  }

  async purgeExpired(now = new Date()): Promise<RetentionReport> {
    const sessionDays = envDays('SESSION_RETENTION_DAYS', 90);
    const messageDays = envDays('MESSAGE_RETENTION_DAYS', 0);
    const report: RetentionReport = { sessionsDeleted: 0, messagesDeleted: 0 };

    if (sessionDays > 0) {
      report.sessionsDeleted = await this.repo.deleteSessionsOlderThan(
        new Date(now.getTime() - sessionDays * DAY_MS),
        BATCH,
      );
    }
    if (messageDays > 0) {
      report.messagesDeleted = await this.repo.deleteMessagesOlderThan(
        new Date(now.getTime() - messageDays * DAY_MS),
        BATCH,
      );
    }
    return report;
  }

  /**
   * Derecho de supresión: elimina el contacto y todo lo que cuelga de él. Solo opera sobre contactos de la
   * organización indicada (nunca de otra). Irreversible: el caller debe haber autenticado y autorizado (OWNER/ADMIN).
   */
  async eraseContact(
    organizationId: string,
    contactId: string,
  ): Promise<ErasureReport> {
    const contact = await this.repo.findContact(organizationId, contactId);
    if (!contact) throw new NotFoundException('Contacto no encontrado');

    const counts = await this.repo.eraseContact(organizationId, contact);

    this.logger.warn(
      `[PRIVACIDAD] Contacto ${contactId} (org ${organizationId}) suprimido por solicitud`,
    );
    return { contactId, ...counts };
  }
}
