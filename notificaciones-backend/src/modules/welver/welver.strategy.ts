// notificaciones-backend/src/modules/welver/welver.strategy.ts
// Strategy de notificaciones para Welver. NUNCA lanza.
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { NotifProjectStrategyRegistry }     from '../../core/strategies/project-strategy.registry.js';
import {
  ProjectType, type NotifProjectStrategy,
  type NotifEnrichInput, type NotifSentResult,
} from '../../core/strategies/project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE, type NotifProjectContext, type OrganizationProfile,
} from '../../core/strategies/project-context.interface.js';

@Injectable()
export class WelverNotifStrategy implements NotifProjectStrategy, OnModuleInit {
  private readonly logger = new Logger(WelverNotifStrategy.name);

  constructor(private readonly registry: NotifProjectStrategyRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('WelverNotifStrategy registrada');
  }

  getProjectType(): ProjectType { return ProjectType.WELVER; }

  async enrichNotifContext(input: NotifEnrichInput): Promise<NotifProjectContext> {
    try {
      // Welver prefiere WhatsApp si está disponible, sino email
      const preferredChannel = input.channel as NotifProjectContext['preferredChannel'] ?? 'whatsapp';
      return {
        preferredChannel,
        enabledChannels: ['whatsapp', 'email'],
        locale:          'es',
        orgProfile:      { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
        businessData:    { notificationType: input.notificationType },
      };
    } catch (err: unknown) {
      this.logger.error(`WelverNotifStrategy.enrich falló: ${err instanceof Error ? err.message : String(err)}`);
      return {
        preferredChannel: 'email', enabledChannels: ['email'], locale: 'es',
        orgProfile: { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
        businessData: {},
      };
    }
  }

  async afterNotifSent(result: NotifSentResult, _context: NotifProjectContext): Promise<void> {
    try {
      this.logger.debug(`[welver-notif] sent — id=${result.notificationId} status=${result.status} channel=${result.channel}`);
    } catch (err: unknown) {
      this.logger.error(`WelverNotifStrategy.after falló: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    return { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };
  }
}
