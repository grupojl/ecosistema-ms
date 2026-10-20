// chatia-backend/src/modules/common/common-api.module.ts
//
// API HTTP COMÚN a todos los ecosistemas (/api/v1/...). El ecosistema se resuelve por el token (TenantGuard),
// no por la URL. Acá viven los controllers que antes estaban dentro de core/ (core/ no tiene controllers).
//
// Qué va acá:   endpoints cuyo contrato es igual para Welver, Manzana, Mexus y los que vengan.
// Qué NO va:    lógica de un ecosistema. Lo que cambia entre ecosistemas se expresa en su strategy/config
//               (modules/<eco>/), y un endpoint que solo existe en un ecosistema va en modules/<eco>/ bajo
//               /api/<eco>/v1/....
import { Module } from '@nestjs/common';
import { PrivacyModule } from '@/core/privacy/privacy.module.js';
import { AgentsModule } from '@/core/agents/agents.module.js';
import { AiConfigModule } from '@/core/ai-config/ai-config.module.js';
import { AssistantModule } from '@/core/assistant/assistant.module.js';
import { ContactsModule } from '@/core/contacts/contacts.module.js';
import { ConversationsModule } from '@/core/conversations/conversations.module.js';
import { EcosystemModule } from '@/core/ecosystem/ecosystem.module.js';
import { FaqModule } from '@/core/faq/faq.module.js';
import { MessagesModule } from '@/core/messages/messages.module.js';
import { NotificationsModule } from '@/core/notifications/notifications.module.js';
import { WebhooksModule } from '@/core/webhooks/webhooks.module.js';
import { WidgetModule } from '@/core/widget/widget.module.js';
import { ChannelAccountsModule } from '@/core/channel-accounts/channel-accounts.module.js';
import { ProjectsModule } from '@/core/projects/projects.module.js';
import { AgentNotificationsController } from '@/modules/common/agent-notifications/agent-notifications.controller.js';
import { ChannelAccountsController } from '@/modules/common/channel-accounts/channel-accounts.controller.js';
import { WhatsAppInternalController } from '@/modules/common/channel-accounts/whatsapp-internal.controller.js';
import { WhatsAppOnboardingController } from '@/modules/common/channel-accounts/whatsapp-onboarding.controller.js';
import { WebhooksController } from '@/modules/common/webhooks/webhooks.controller.js';
import { WidgetController } from '@/modules/common/widget/widget.controller.js';
import { AgentsController } from '@/modules/common/agents/agents.controller.js';
import { AiConfigController } from '@/modules/common/ai-config/ai-config.controller.js';
import { AssistantController } from '@/modules/common/assistant/assistant.controller.js';
import { ContactsController } from '@/modules/common/contacts/contacts.controller.js';
import { ConversationsController } from '@/modules/common/conversations/conversations.controller.js';
import { EcosystemController } from '@/modules/common/ecosystem/ecosystem.controller.js';
import { FaqController } from '@/modules/common/faq/faq.controller.js';
import { MessagesController } from '@/modules/common/messages/messages.controller.js';
import { NotificationsController } from '@/modules/common/notifications/notifications.controller.js';
import { ProjectsController } from '@/modules/common/projects/projects.controller.js';

@Module({
  imports: [
    PrivacyModule,
    AgentsModule,
    AiConfigModule,
    AssistantModule,
    ContactsModule,
    ConversationsModule,
    EcosystemModule,
    FaqModule,
    MessagesModule,
    NotificationsModule,
    ProjectsModule,
    WebhooksModule,
    WidgetModule,
    ChannelAccountsModule,
  ],
  controllers: [
    AgentsController,
    AiConfigController,
    AssistantController,
    ContactsController,
    ConversationsController,
    EcosystemController,
    FaqController,
    MessagesController,
    NotificationsController,
    ProjectsController,
    AgentNotificationsController,
    ChannelAccountsController,
    WhatsAppOnboardingController,
    WhatsAppInternalController,
    WebhooksController,
    WidgetController,
  ],
})
export class CommonApiModule {}
