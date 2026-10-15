// Integración con Postgres real: historial de sesión bajo concurrencia + repository de agentes.
import {
  DbFixture,
  describeDb,
  type Tenant,
} from '@/infrastructure/testing/integration/db-fixture.js';
import { AssistantSessionService } from '@/core/assistant/session/assistant-session.service.js';
import { PrismaAssistantSessionRepository } from '@/infrastructure/prisma/repositories/prisma-assistant.repository.js';
import { PrismaAgentsRepository } from '@/infrastructure/prisma/repositories/prisma-agents.repository.js';

describeDb('sesión del asistente y agentes (Postgres real)', () => {
  const fx = new DbFixture();
  let a: Tenant;
  let b: Tenant;
  let sessions: AssistantSessionService;
  let agents: PrismaAgentsRepository;
  let configId: string;

  beforeAll(async () => {
    await fx.connect();
    a = await fx.tenant('sa');
    b = await fx.tenant('sb');
    sessions = new AssistantSessionService(
      new PrismaAssistantSessionRepository(fx.prisma),
    );
    agents = new PrismaAgentsRepository(fx.prisma);
    configId = (
      await fx.prisma.assistantConfig.create({
        data: {
          projectId: a.projectId,
          organizationId: a.organizationId,
          systemPrompt: 'x',
        },
      })
    ).id;
  }, 30_000);

  afterAll(async () => {
    const orgs = [a.organizationId, b.organizationId];
    await fx.prisma.assistantSession.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.prisma.assistantConfig.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.prisma.agent.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.cleanup();
  }, 30_000);

  describe('appendMessage', () => {
    it('no pierde mensajes cuando llegan en paralelo (antes se pisaban)', async () => {
      const s = await sessions.getOrCreate(
        configId,
        a.organizationId,
        `u-${fx.run}`,
        'whatsapp',
      );
      const N = 25;
      await Promise.all(
        Array.from({ length: N }, (_, i) =>
          sessions.appendMessage(s.id, 'user', `mensaje ${i}`),
        ),
      );

      const history = await sessions.getHistory(s.id, 100);
      expect(history).toHaveLength(N);
      expect(new Set(history.map((m) => m.content)).size).toBe(N);
      const row = await fx.prisma.assistantSession.findUnique({
        where: { id: s.id },
      });
      expect(row?.lastMessageAt).not.toBeNull();
    });

    it('conserva el orden secuencial y tolera un historial no-array', async () => {
      const s = await sessions.getOrCreate(
        configId,
        a.organizationId,
        `seq-${fx.run}`,
        'web',
      );
      await fx.prisma.assistantSession.update({
        where: { id: s.id },
        data: { history: { corrupto: true } },
      });
      await sessions.appendMessage(s.id, 'user', 'uno');
      await sessions.appendMessage(s.id, 'assistant', 'dos');
      expect((await sessions.getHistory(s.id)).map((m) => m.content)).toEqual([
        'uno',
        'dos',
      ]);
    });

    it('una sesión inexistente da 404 y no crea nada', async () => {
      await expect(
        sessions.appendMessage('no-existe', 'user', 'x'),
      ).rejects.toThrow('no encontrada');
    });
  });

  describe('PrismaAgentsRepository', () => {
    it('el upsert de un agente existente NO lo mueve a otra organización', async () => {
      const uid = `ag-${fx.run}`;
      const created = await agents.upsertByFirebaseUid({
        firebaseUid: uid,
        organizationId: a.organizationId,
        name: 'Ana',
        email: `ana-${fx.run}@x.com`,
      });
      expect(created.organizationId).toBe(a.organizationId);

      const again = await agents.upsertByFirebaseUid({
        firebaseUid: uid,
        organizationId: b.organizationId, // intento de reasignación
        name: 'Ana 2',
        email: `ana-${fx.run}@x.com`,
      });
      expect(again.id).toBe(created.id);
      expect(again.organizationId).toBe(a.organizationId);
      expect(again.name).toBe('Ana 2');
    });

    it('find/list/update están acotados a la organización', async () => {
      const mine = await agents.upsertByFirebaseUid({
        firebaseUid: `m-${fx.run}`,
        organizationId: a.organizationId,
        name: 'Mía',
        email: `mia-${fx.run}@x.com`,
      });
      await agents.upsertByFirebaseUid({
        firebaseUid: `o-${fx.run}`,
        organizationId: b.organizationId,
        name: 'Ajena',
        email: `ajena-${fx.run}@x.com`,
      });

      expect(
        await agents.findInOrganization(mine.id, b.organizationId),
      ).toBeNull();
      expect(
        (await agents.listActive(a.organizationId)).every(
          (x) => x.organizationId === a.organizationId,
        ),
      ).toBe(true);
      await expect(
        agents.update(mine.id, b.organizationId, { name: 'hack' }),
      ).rejects.toThrow();
      expect(
        (await agents.update(mine.id, a.organizationId, { isActive: false }))
          .isActive,
      ).toBe(false);
      expect(
        (await agents.listActive(a.organizationId)).some(
          (x) => x.id === mine.id,
        ),
      ).toBe(false);
    });
  });
});
