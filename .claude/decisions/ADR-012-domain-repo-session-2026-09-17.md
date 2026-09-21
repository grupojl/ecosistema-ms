# ADR-012 — Domain/Repository completo + fixes de sesión 2026-09-17

**Fecha:** 2026-09-17
**Estado:** Aceptado — implementado
**Repo:** grupojl/ecosistema-ms

## Qué se hizo

### chatia-backend
- `conversations/repository/conversations.repository.interface.ts` — `ChannelAccountRecord` ahora tiene `ecosystemId`
- `conversations/repository/prisma-conversations.repository.ts` — `findChannelAccountById` hace `include: { organization: { select: { ecosystemId } } }`
- `conversations/conversations.service.ts` — `account.organization.ecosystemId` → `account.ecosystemId`
- `contacts/domain/contact.errors.ts` — domain errors puros
- `contacts/repository/contacts.repository.interface.ts` — `IContactsRepository` + `CONTACTS_REPOSITORY`
- `contacts/repository/prisma-contacts.repository.ts` — adaptador concreto
- `contacts/contacts.module.ts` — binding `{ provide: CONTACTS_REPOSITORY, useClass: PrismaContactsRepository }`
- `contacts/contacts.service.ts` — `@Inject(CONTACTS_REPOSITORY)` — sin PrismaService
- `ai-config/schemas.ts` — `UpdateAiConfigSchema` con Zod (reemplaza class-validator)
- `ai-config/ai-config.service.ts` — class-validator eliminado

### notificaciones-backend
- `notifications/domain/notification.errors.ts` — domain errors + `assertValidChannel`
- `notifications/repository/notifications.repository.interface.ts` — `INotificationsRepository`
- `notifications/repository/prisma-notifications.repository.ts` — adaptador concreto
- `notifications/notifications.service.ts` — `@Inject(NOTIFICATIONS_REPOSITORY)` — `enqueue()` intacto
- `package.json` — class-validator eliminado

### workers-backend
- `campaigns/domain/campaign.errors.ts` — máquina de estados + `assertValidCampaignTransition`
- `campaigns/repository/campaigns.repository.interface.ts` — `ICampaignsRepository`
- `campaigns/repository/prisma-campaigns.repository.ts` — adaptador concreto
- `campaigns/campaigns.module.ts` — binding `CAMPAIGNS_REPOSITORY`
- `campaigns/campaigns.service.ts` — `@Inject(CAMPAIGNS_REPOSITORY)` — excepciones documentadas

## Excepciones documentadas

`CampaignsService` mantiene `PrismaService` para:
- `dispatchCampaign()` — multi-tabla sin tx explícita
- `addRecipients()` — campaignRecipient.createMany + campaign.update
- `getStats()` — groupBy no en ICampaignsRepository

Scope S5: cuando ICampaignsRepository soporte estas operaciones, completar la migración.

## Impacto en score

Domain/Repository: 8.0/10 → **9.0/10**
Promedio: 8.6/10 → **9.0/10**

## Pendiente — ECO-CB-01

`AssistantChatService` no tiene `CircuitBreakerService` inyectado.
`CircuitOpenError` no se captura — el cliente recibe 500 en lugar de escalación.
Ver deuda-tecnica.md sección ECO-CB-01 para el fix.
