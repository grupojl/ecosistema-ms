// Integración con Postgres REAL: las consultas de los repositories Prisma de infrastructure/ que los unitarios
// (con repositories mockeados) no pueden ver — filtros por organización, paginación, conteos, upserts y restricciones.
// Cada repository se prueba con DOS tenants: lo del tenant B nunca aparece en consultas del tenant A.
import {
  DbFixture,
  describeDb,
  type Tenant,
} from '@/infrastructure/testing/integration/db-fixture.js';
import { PrismaMessagesRepository } from '@/infrastructure/prisma/repositories/prisma-messages.repository.js';
import { PrismaNotificationsRepository } from '@/infrastructure/prisma/repositories/prisma-notifications.repository.js';
import { PrismaProjectsRepository } from '@/infrastructure/prisma/repositories/prisma-projects.repository.js';
import { PrismaAiConfigRepository } from '@/infrastructure/prisma/repositories/prisma-ai-config.repository.js';
import { PrismaAssistantConfigRepository } from '@/infrastructure/prisma/repositories/prisma-assistant.repository.js';
import { PrismaOrganizationsRepository } from '@/infrastructure/prisma/repositories/prisma-organizations.repository.js';
import { PrismaEcosystemsRepository } from '@/infrastructure/prisma/repositories/prisma-ecosystems.repository.js';
import { PrismaAgentsRepository } from '@/infrastructure/prisma/repositories/prisma-agents.repository.js';
import { PrismaConversationsRepository } from '@/infrastructure/prisma/repositories/prisma-conversations.repository.js';
import { PrismaKnowledgeRepository } from '@/infrastructure/prisma/repositories/prisma-knowledge.repository.js';

describeDb('repositories Prisma (Postgres real)', () => {
  const fx = new DbFixture();
  let a: Tenant;
  let b: Tenant;
  let accountA: string;
  let accountB: string;
  let convA: string;
  let convB: string;
  let agentA: string;
  let agentA2: string;
  let agentB: string;

  beforeAll(async () => {
    await fx.connect();
    a = await fx.tenant('rpa');
    b = await fx.tenant('rpb');
    const mkAccount = async (t: Tenant, label: string) =>
      (
        await fx.prisma.channelAccount.create({
          data: {
            organizationId: t.organizationId,
            channelType: 'WHATSAPP',
            name: label,
            externalId: `rp-${label}-${fx.run}`,
            accessToken: 't',
            projectId: t.projectId,
          },
        })
      ).id;
    accountA = await mkAccount(a, 'a');
    accountB = await mkAccount(b, 'b');
    const mkConv = async (t: Tenant, account: string, ext: string) => {
      const contact = await fx.prisma.contact.create({
        data: {
          organizationId: t.organizationId,
          channelType: 'WHATSAPP',
          externalId: `${ext}-${fx.run}`,
        },
      });
      return (
        await fx.prisma.conversation.create({
          data: { channelAccountId: account, contactId: contact.id },
        })
      ).id;
    };
    convA = await mkConv(a, accountA, 'ca');
    convB = await mkConv(b, accountB, 'cb');
    const mkAgent = async (t: Tenant, label: string, createdAt: Date) =>
      (
        await fx.prisma.agent.create({
          data: {
            organizationId: t.organizationId,
            firebaseUid: `rp-${label}-${fx.run}`,
            name: label,
            email: `${label}-${fx.run}@x.com`,
            createdAt,
          },
        })
      ).id;
    agentA = await mkAgent(a, 'viejo', new Date('2026-01-01'));
    agentA2 = await mkAgent(a, 'nuevo', new Date('2026-06-01'));
    agentB = await mkAgent(b, 'ajeno', new Date('2026-01-01'));
  }, 30_000);

  afterAll(async () => {
    const orgs = [a.organizationId, b.organizationId];
    await fx.prisma.notification.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.prisma.message.deleteMany({
      where: {
        conversation: { channelAccount: { organizationId: { in: orgs } } },
      },
    });
    await fx.prisma.conversation.deleteMany({
      where: { channelAccount: { organizationId: { in: orgs } } },
    });
    await fx.prisma.contact.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.prisma.aiConfig.deleteMany({
      where: { channelAccount: { organizationId: { in: orgs } } },
    });
    await fx.prisma.assistantConfig.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.prisma.agent.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.cleanup();
  }, 30_000);

  describe('messages', () => {
    it('lista paginada por conversación, ownership por organización y estadísticas aisladas', async () => {
      const repo = new PrismaMessagesRepository(fx.prisma);
      await fx.prisma.message.createMany({
        data: [
          { conversationId: convA, direction: 'INBOUND', content: 'm1' },
          {
            conversationId: convA,
            direction: 'OUTBOUND',
            content: 'm2',
            isAiGenerated: true,
            tokensUsed: 30,
          },
          { conversationId: convA, direction: 'INBOUND', content: 'm3' },
          { conversationId: convB, direction: 'INBOUND', content: 'ajeno' },
        ],
      });

      expect(await repo.conversationBelongsTo(convA, a.organizationId)).toBe(
        true,
      );
      expect(await repo.conversationBelongsTo(convA, b.organizationId)).toBe(
        false,
      );

      const page1 = await repo.listByConversation(convA, 0, 2);
      expect(page1.total).toBe(3);
      expect(page1.messages.map((m) => m.content)).toEqual(['m1', 'm2']);
      const page2 = await repo.listByConversation(convA, 2, 2);
      expect(page2.messages.map((m) => m.content)).toEqual(['m3']);

      expect(await repo.statsForOrganization(a.organizationId)).toEqual({
        total: 3,
        inbound: 2,
        outbound: 1,
        aiGenerated: 1,
        totalTokensUsed: 30,
      });
      expect((await repo.statsForOrganization(b.organizationId)).total).toBe(1);
    });
  });

  describe('notifications', () => {
    it('crea, lista con filtro de no leídas, y marca como leídas solo las del agente', async () => {
      const repo = new PrismaNotificationsRepository(fx.prisma);
      const mk = (agentId: string, org: string, title: string) =>
        repo.create({
          organizationId: org,
          agentId,
          conversationId: null,
          type: 'NEW_MESSAGE',
          title,
          body: 'b',
        });
      const n1 = await mk(agentA, a.organizationId, 'n1');
      await mk(agentA, a.organizationId, 'n2');
      await mk(agentB, b.organizationId, 'ajena');

      const all = await repo.listForAgent(agentA, false, 0, 10);
      expect(all.total).toBe(2);
      expect(all.unreadCount).toBe(2);

      // otro agente NO puede marcar una notificación que no es suya
      expect(await repo.markRead(n1.id, agentB)).toBe(0);
      expect(await repo.markRead(n1.id, agentA)).toBe(1);

      const unread = await repo.listForAgent(agentA, true, 0, 10);
      expect(unread.rows.map((n) => n.title)).toEqual(['n2']);
      expect(unread.total).toBe(1);
      expect(all.rows.every((n) => n.agentId === agentA)).toBe(true);

      expect(await repo.markAllRead(agentA)).toBe(1);
      expect((await repo.listForAgent(agentA, false, 0, 10)).unreadCount).toBe(
        0,
      );
      expect((await repo.listForAgent(agentB, false, 0, 10)).unreadCount).toBe(
        1,
      );
    });
  });

  describe('projects', () => {
    it('slug único por organización; mismo slug en otra organización es válido', async () => {
      const repo = new PrismaProjectsRepository(fx.prisma);
      const created = await repo.create({
        organizationId: a.organizationId,
        slug: 'otro-proyecto',
        name: 'Otro',
      });
      expect(
        (await repo.findBySlug(a.organizationId, 'otro-proyecto'))?.id,
      ).toBe(created.id);
      expect(
        await repo.findBySlug(b.organizationId, 'otro-proyecto'),
      ).toBeNull();
      await expect(
        repo.create({
          organizationId: a.organizationId,
          slug: 'otro-proyecto',
          name: 'Dup',
        }),
      ).rejects.toThrow();
      const sameSlugOtherOrg = await repo.create({
        organizationId: b.organizationId,
        slug: 'otro-proyecto',
        name: 'B',
      });
      expect(sameSlugOtherOrg.organizationId).toBe(b.organizationId);

      expect(
        await repo.findByIdInOrganization(created.id, b.organizationId),
      ).toBeNull();
      const updated = await repo.update(a.organizationId, 'otro-proyecto', {
        name: 'Renombrado',
      });
      expect(updated.name).toBe('Renombrado');
      const list = await repo.listWithCounts(a.organizationId);
      expect(list.every((p) => p.organizationId === a.organizationId)).toBe(
        true,
      );
      expect(list[0]!._count).toEqual({
        assistantConfigs: expect.any(Number),
        knowledgeBases: expect.any(Number),
      });

      await repo.remove(a.organizationId, 'otro-proyecto');
      expect(
        await repo.findBySlug(a.organizationId, 'otro-proyecto'),
      ).toBeNull();
    });

    it('proyecto por defecto = el activo más antiguo; upsertBySlug es idempotente; el widget detecta slugs ambiguos', async () => {
      const repo = new PrismaProjectsRepository(fx.prisma);
      const def = await repo.findDefaultActiveWithConfigs(a.organizationId);
      expect(def?.id).toBe(a.projectId);

      const first = await repo.upsertBySlug(
        a.organizationId,
        'por-defecto',
        'X',
      );
      const second = await repo.upsertBySlug(
        a.organizationId,
        'por-defecto',
        'Y',
      );
      expect(second.id).toBe(first.id);

      // mismo slug en dos organizaciones → sin ?org= devuelve 2 (ambiguo), con org devuelve 1
      await repo.upsertBySlug(b.organizationId, 'por-defecto', 'B');
      expect(await repo.findActiveBySlugForWidget('por-defecto')).toHaveLength(
        2,
      );
      const scoped = await repo.findActiveBySlugForWidget(
        'por-defecto',
        a.organizationId,
      );
      expect(scoped).toHaveLength(1);
      expect(scoped[0]!.organization.ecosystemId).toBe(a.ecosystemId);
    });
  });

  describe('ai-config y assistant-config', () => {
    it('ai-config: ownership de la cuenta, upsert que solo toca lo enviado, y setEnabled', async () => {
      const repo = new PrismaAiConfigRepository(fx.prisma);
      expect(
        await repo.channelAccountBelongsTo(accountA, a.organizationId),
      ).toBe(true);
      expect(
        await repo.channelAccountBelongsTo(accountA, b.organizationId),
      ).toBe(false);
      expect(await repo.findByChannelAccount(accountA)).toBeNull();

      const base = {
        channelAccountId: accountA,
        systemPrompt: 'p',
        personaName: 'Sofi',
        humanTakeoverKeywords: ['humano'],
      };
      const created = await repo.upsert(accountA, base, { temperature: 0.2 });
      expect(created.humanTakeoverKeywords).toEqual(['humano']);
      const updated = await repo.upsert(accountA, base, { temperature: 0.2 });
      expect(updated.temperature).toBeCloseTo(0.2);
      expect(updated.personaName).toBe('Sofi'); // lo no enviado se conserva

      expect((await repo.setEnabled(accountA, false)).isEnabled).toBe(false);
    });

    it('assistant-config: crea, ownership, update y modelo de la primera config habilitada', async () => {
      const repo = new PrismaAssistantConfigRepository(fx.prisma);
      expect(await repo.findByProjectId(a.projectId)).toBeNull();
      const cfg = await repo.create({
        projectId: a.projectId,
        organizationId: a.organizationId,
        systemPrompt: 'hola',
      });
      expect((await repo.findByProjectId(a.projectId))?.id).toBe(cfg.id);
      expect(await repo.findOwned(a.projectId, b.organizationId)).toBeNull();
      expect((await repo.findOwned(a.projectId, a.organizationId))?.id).toBe(
        cfg.id,
      );

      expect(
        (await repo.update(a.projectId, { personaName: 'Nueva' } as never))
          .personaName,
      ).toBe('Nueva');
      expect(
        await repo.findEnabledModelForOrganization(a.organizationId),
      ).toEqual({ groqModel: 'openai/gpt-oss-120b' });
      await repo.setEnabled(a.projectId, false);
      expect(
        await repo.findEnabledModelForOrganization(a.organizationId),
      ).toBeNull();
      expect(
        await repo.findEnabledModelForOrganization(b.organizationId),
      ).toBeNull();
    });
  });

  describe('organizations y ecosystems', () => {
    it('organizations: lectura, ecosistema dueño y upsert dentro de un ecosistema', async () => {
      const repo = new PrismaOrganizationsRepository(fx.prisma);
      expect((await repo.findById(a.organizationId))?.ecosystemId).toBe(
        a.ecosystemId,
      );
      expect(await repo.findOwnerEcosystemId(a.organizationId)).toEqual({
        ecosystemId: a.ecosystemId,
      });
      expect(await repo.findOwnerEcosystemId('no-existe')).toBeNull();
      expect(await repo.findNameAndSlug(a.organizationId)).toMatchObject({
        name: expect.any(String),
      });
      const created = await repo.upsertForEcosystem(
        a.ecosystemId,
        `${a.organizationId}-nueva`,
        'Nueva',
        'nueva',
      );
      expect(created.slug).toBe('nueva');
      const again = await repo.upsertForEcosystem(
        a.ecosystemId,
        created.id,
        'Renombrada',
      );
      expect(again.name).toBe('Renombrada');
      expect(again.slug).toBe('nueva'); // sin slug no lo pisa
      await fx.prisma.organization.delete({ where: { id: created.id } });
    });

    it('ecosystems: alta, búsqueda por firebaseProjectId, resumen con conteo, config y desactivación', async () => {
      const repo = new PrismaEcosystemsRepository(fx.prisma);
      const fb = `rp-fb-${fx.run}`;
      const created = await repo.create({
        firebaseProjectId: fb,
        name: 'Prueba',
        config: { plan: 'x' },
      });
      expect((await repo.findByFirebaseProjectId(fb))?.id).toBe(created.id);
      expect((await repo.findById(created.id))?.name).toBe('Prueba');
      expect(
        (await repo.listSummaries()).some((e) => e.id === created.id),
      ).toBe(true);
      const upd = await repo.updateConfig(created.id, {
        projectType: 'welver',
      });
      expect(upd.config).toEqual({ projectType: 'welver' });
      await repo.deactivate(created.id);
      expect((await repo.findById(created.id))?.isActive).toBe(false);
      await fx.prisma.ecosystem.delete({ where: { id: created.id } });
    });
  });

  describe('agents y conversations (métodos de asignación y etapa)', () => {
    it('agents.listActiveIdsByCreation: solo activos de la organización, del más antiguo al más nuevo', async () => {
      const repo = new PrismaAgentsRepository(fx.prisma);
      expect(await repo.listActiveIdsByCreation(a.organizationId)).toEqual([
        agentA,
        agentA2,
      ]);
      await fx.prisma.agent.update({
        where: { id: agentA2 },
        data: { isActive: false },
      });
      expect(await repo.listActiveIdsByCreation(a.organizationId)).toEqual([
        agentA,
      ]);
      expect(await repo.listActiveIdsByCreation(b.organizationId)).toEqual([
        agentB,
      ]);
      await fx.prisma.agent.update({
        where: { id: agentA2 },
        data: { isActive: true },
      });
    });

    it('conversations: carga por agente, etapa del embudo y "hay agentes en línea"', async () => {
      const repo = new PrismaConversationsRepository(fx.prisma);
      expect(await repo.countOpenWithAgent(a.organizationId)).toBe(0); // todavía sin agente asignado

      await fx.prisma.conversation.update({
        where: { id: convA },
        data: { assignedAgentId: agentA },
      });
      const counts = await repo.countActiveByAgents([agentA, agentA2, agentB]);
      expect(counts).toEqual([{ agentId: agentA, count: 1 }]);
      // una conversación OPEN con agente asignado de ESTA organización cuenta; la de otra no
      expect(await repo.countOpenWithAgent(a.organizationId)).toBe(1);
      expect(await repo.countOpenWithAgent(b.organizationId)).toBe(0);

      await repo.updateStage(convA, a.organizationId, 'QUALIFYING');
      expect(
        (await fx.prisma.conversation.findUnique({ where: { id: convA } }))
          ?.stage,
      ).toBe('QUALIFYING');
      // una etapa que no existe en la base se rechaza con un error claro
      await expect(
        repo.updateStage(convA, a.organizationId, 'INVENTADA'),
      ).rejects.toThrow(/Etapa de conversación inválida/);
      // desde OTRA organización no cambia nada
      await repo.updateStage(convA, b.organizationId, 'CLOSING');
      expect(
        (await fx.prisma.conversation.findUnique({ where: { id: convA } }))
          ?.stage,
      ).toBe('QUALIFYING');
    });
  });

  describe('knowledge (fragmentos y estados)', () => {
    it('reindexar borra fragmentos; applyStatus es por organización; búsqueda por texto acotada a la KB', async () => {
      const repo = new PrismaKnowledgeRepository(fx.prisma);
      const doc = await repo.createDocument({
        title: 'Horarios',
        sourceType: 'TEXT',
        rawContent: 'Atendemos de lunes a viernes de 8 a 14',
        knowledgeBaseId: a.kbId,
        organizationId: a.organizationId,
      } as never);
      await repo.replaceChunks(doc.id, [
        {
          content: 'Atendemos de lunes a viernes',
          chunkIndex: 0,
          embeddingModel: 'm',
          tokenCount: 4,
          embedding: [0.1, 0.2],
        },
      ]);
      await repo.markIndexed(doc.id, 1);

      const hits = await repo.searchChunksByText(
        a.kbId,
        ['lunes'],
        a.organizationId,
        10,
      );
      expect(hits).toHaveLength(1);
      expect(hits[0]!.document.title).toBe('Horarios');
      expect(
        await repo.searchChunksByText(a.kbId, ['lunes'], b.organizationId, 10),
      ).toHaveLength(0);
      expect(
        await repo.listIndexedChunks(a.kbId, a.organizationId),
      ).toHaveLength(1);
      expect(
        await repo.listIndexedChunks(a.kbId, b.organizationId),
      ).toHaveLength(0);

      // un servicio interno de otra organización no puede cambiar el estado
      await repo.applyStatus(doc.id, b.organizationId, {
        status: 'FAILED',
        error: 'x',
      });
      expect((await repo.findDocument(doc.id, a.organizationId))?.status).toBe(
        'INDEXED',
      );
      await repo.applyStatus(doc.id, a.organizationId, {
        status: 'FAILED',
        error: 'x'.repeat(900),
      });
      const failed = await repo.findDocument(doc.id, a.organizationId);
      expect(failed?.status).toBe('FAILED');
      expect(failed?.errorMessage).toHaveLength(500);

      await repo.resetDocumentForReindex(doc.id);
      expect((await repo.findDocument(doc.id, a.organizationId))?.status).toBe(
        'PENDING',
      );
      expect(
        await repo.listIndexedChunks(a.kbId, a.organizationId),
      ).toHaveLength(0);

      const stats = await repo.getStats(a.kbId);
      expect(stats.total).toBe(1);
      expect(stats.chunks).toBe(0);
      expect(
        await repo.countActiveKnowledgeBases(a.organizationId),
      ).toBeGreaterThanOrEqual(1);
      expect(await repo.projectBelongsTo(a.projectId, b.organizationId)).toBe(
        false,
      );
      await repo.deleteDocument(doc.id);
    });
  });
});
