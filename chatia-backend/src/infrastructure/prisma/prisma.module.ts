// src/infrastructure/prisma/prisma.module.ts
//
// Persistencia: PrismaService + las implementaciones Prisma de los repositorios de core/.
// core/ define las interfaces y los tokens de DI; el binding token → implementación vive acá (ADR-022),
// así los módulos de core/ no conocen Prisma.
import { Global, Module } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { CONTACTS_REPOSITORY } from '@/core/contacts/repository/contacts.repository.interface.js';
import { CONVERSATIONS_REPOSITORY } from '@/core/conversations/repository/conversations.repository.interface.js';
import { ORGANIZATION_CONFIG_REPO } from '@/core/organization-config/organization-config.repository.interface.js';
import { AGENTS_REPOSITORY } from '@/core/agents/repository/agents.repository.interface.js';
import { PrismaContactsRepository } from '@/infrastructure/prisma/repositories/prisma-contacts.repository.js';
import { PrismaConversationsRepository } from '@/infrastructure/prisma/repositories/prisma-conversations.repository.js';
import { PrismaOrganizationConfigRepository } from '@/infrastructure/prisma/repositories/prisma-organization-config.repository.js';
import { PrismaAgentsRepository } from '@/infrastructure/prisma/repositories/prisma-agents.repository.js';
import { ORGANIZATIONS_REPOSITORY } from '@/core/organizations/repository/organizations.repository.interface.js';
import { PrismaOrganizationsRepository } from '@/infrastructure/prisma/repositories/prisma-organizations.repository.js';
import { ECOSYSTEMS_REPOSITORY } from '@/core/ecosystem/repository/ecosystems.repository.interface.js';
import { PrismaEcosystemsRepository } from '@/infrastructure/prisma/repositories/prisma-ecosystems.repository.js';
import { CHANNEL_ACCOUNTS_REPOSITORY } from '@/core/channel-accounts/repository/channel-accounts.repository.interface.js';
import { PrismaChannelAccountsRepository } from '@/infrastructure/prisma/repositories/prisma-channel-accounts.repository.js';
import { AI_CONFIG_REPOSITORY } from '@/core/ai-config/repository/ai-config.repository.interface.js';
import { PrismaAiConfigRepository } from '@/infrastructure/prisma/repositories/prisma-ai-config.repository.js';
import { PROJECTS_REPOSITORY } from '@/core/projects/repository/projects.repository.interface.js';
import { PrismaProjectsRepository } from '@/infrastructure/prisma/repositories/prisma-projects.repository.js';
import { KNOWLEDGE_REPOSITORY } from '@/core/faq/repository/knowledge.repository.interface.js';
import { PrismaKnowledgeRepository } from '@/infrastructure/prisma/repositories/prisma-knowledge.repository.js';
import { KB_VECTOR_REPOSITORY } from '@/core/faq/repository/kb-vector.repository.interface.js';
import { PrismaKbVectorRepository } from '@/infrastructure/prisma/repositories/prisma-kb-vector.repository.js';
import { MESSAGES_REPOSITORY } from '@/core/messages/repository/messages.repository.interface.js';
import { PrismaMessagesRepository } from '@/infrastructure/prisma/repositories/prisma-messages.repository.js';
import { NOTIFICATIONS_REPOSITORY } from '@/core/notifications/repository/notifications.repository.interface.js';
import { PrismaNotificationsRepository } from '@/infrastructure/prisma/repositories/prisma-notifications.repository.js';
import { PRIVACY_REPOSITORY } from '@/core/privacy/repository/privacy.repository.interface.js';
import { PrismaPrivacyRepository } from '@/infrastructure/prisma/repositories/prisma-privacy.repository.js';
import {
  ASSISTANT_CONFIG_REPOSITORY,
  ASSISTANT_SESSION_REPOSITORY,
} from '@/core/assistant/repository/assistant.repository.interface.js';
import {
  PrismaAssistantConfigRepository,
  PrismaAssistantSessionRepository,
} from '@/infrastructure/prisma/repositories/prisma-assistant.repository.js';

const REPOSITORIES = [
  { provide: CONTACTS_REPOSITORY, useClass: PrismaContactsRepository },
  {
    provide: CONVERSATIONS_REPOSITORY,
    useClass: PrismaConversationsRepository,
  },
  {
    provide: ORGANIZATION_CONFIG_REPO,
    useClass: PrismaOrganizationConfigRepository,
  },
  { provide: AGENTS_REPOSITORY, useClass: PrismaAgentsRepository },
  {
    provide: ORGANIZATIONS_REPOSITORY,
    useClass: PrismaOrganizationsRepository,
  },
  { provide: ECOSYSTEMS_REPOSITORY, useClass: PrismaEcosystemsRepository },
  {
    provide: CHANNEL_ACCOUNTS_REPOSITORY,
    useClass: PrismaChannelAccountsRepository,
  },
  { provide: AI_CONFIG_REPOSITORY, useClass: PrismaAiConfigRepository },
  { provide: PROJECTS_REPOSITORY, useClass: PrismaProjectsRepository },
  { provide: KNOWLEDGE_REPOSITORY, useClass: PrismaKnowledgeRepository },
  { provide: KB_VECTOR_REPOSITORY, useClass: PrismaKbVectorRepository },
  { provide: MESSAGES_REPOSITORY, useClass: PrismaMessagesRepository },
  {
    provide: NOTIFICATIONS_REPOSITORY,
    useClass: PrismaNotificationsRepository,
  },
  { provide: PRIVACY_REPOSITORY, useClass: PrismaPrivacyRepository },
  {
    provide: ASSISTANT_CONFIG_REPOSITORY,
    useClass: PrismaAssistantConfigRepository,
  },
  {
    provide: ASSISTANT_SESSION_REPOSITORY,
    useClass: PrismaAssistantSessionRepository,
  },
];

@Global()
@Module({
  providers: [PrismaService, ...REPOSITORIES],
  exports: [PrismaService, ...REPOSITORIES.map((r) => r.provide)],
})
export class PrismaModule {}
