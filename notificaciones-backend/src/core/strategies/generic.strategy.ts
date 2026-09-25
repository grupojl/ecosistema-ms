// notificaciones-backend/src/core/strategies/generic.strategy.ts
import { Injectable } from '@nestjs/common';
import {
  ProjectType, type NotifProjectStrategy,
  type NotifEnrichInput, type NotifSentResult,
} from './project-strategy.interface.js';
import {
  DEFAULT_ORG_PROFILE, type NotifProjectContext, type OrganizationProfile,
} from './project-context.interface.js';

@Injectable()
export class GenericNotifStrategy implements NotifProjectStrategy {
  getProjectType(): ProjectType { return ProjectType.GENERIC; }

  async enrichNotifContext(input: NotifEnrichInput): Promise<NotifProjectContext> {
    return {
      preferredChannel: 'email', enabledChannels: ['email'],
      locale: 'es',
      orgProfile: { ...DEFAULT_ORG_PROFILE, organizationId: input.organizationId, ecosystemId: input.ecosystemId },
      businessData: {},
    };
  }

  async afterNotifSent(_r: NotifSentResult, _c: NotifProjectContext): Promise<void> { /* no-op */ }

  async resolveOrgProfile(ecosystemId: string, organizationId: string): Promise<OrganizationProfile> {
    return { ...DEFAULT_ORG_PROFILE, organizationId, ecosystemId };
  }
}
