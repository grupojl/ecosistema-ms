// Integración con Postgres real: retención de datos y derecho de supresión.
import { NotFoundException } from '@nestjs/common';
import {
  DbFixture,
  describeDb,
  type Tenant,
} from '@/infrastructure/testing/integration/db-fixture.js';
import { PrismaPrivacyRepository } from '@/infrastructure/prisma/repositories/prisma-privacy.repository.js';
import { RetentionService } from '@/core/privacy/retention.service.js';

describeDb('privacidad — retención y supresión (Postgres real)', () => {
  const fx = new DbFixture();
  let a: Tenant;
  let b: Tenant;
  let svc: RetentionService;
  let accountA: string;

  const seedContact = async (t: Tenant, accountId: string, ext: string) => {
    const contact = await fx.prisma.contact.create({
      data: {
        organizationId: t.organizationId,
        channelType: 'WHATSAPP',
        externalId: ext,
        name: `Ciudadano ${ext}`,
      },
    });
    const conv = await fx.prisma.conversation.create({
      data: { channelAccountId: accountId, contactId: contact.id },
    });
    await fx.prisma.message.createMany({
      data: [
        {
          conversationId: conv.id,
          direction: 'INBOUND',
          content: 'hola, mi DNI es 12345678',
        },
        {
          conversationId: conv.id,
          direction: 'OUTBOUND',
          content: 'respuesta',
        },
      ],
    });
    return { contact, conv };
  };

  beforeAll(async () => {
    await fx.connect();
    a = await fx.tenant('pa');
    b = await fx.tenant('pb');
    svc = new RetentionService(new PrismaPrivacyRepository(fx.prisma));
    accountA = (
      await fx.prisma.channelAccount.create({
        data: {
          organizationId: a.organizationId,
          channelType: 'WHATSAPP',
          name: 'a',
          externalId: `pa-${fx.run}`,
          accessToken: 't',
        },
      })
    ).id;
    await fx.prisma.channelAccount.create({
      data: {
        organizationId: b.organizationId,
        channelType: 'WHATSAPP',
        name: 'b',
        externalId: `pb-${fx.run}`,
        accessToken: 't',
      },
    });
  }, 30_000);

  afterAll(async () => {
    // El fixture borra proyectos/orgs; aquí se limpia lo propio de este test (orden por claves foráneas)
    const orgs = [a.organizationId, b.organizationId];
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
    await fx.prisma.assistantSession.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.prisma.assistantConfig.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await fx.cleanup();
  }, 30_000);

  describe('derecho de supresión', () => {
    it('borra el contacto con sus conversaciones, mensajes y sesiones, y NADA más', async () => {
      const victim = await seedContact(a, accountA, `v-${fx.run}`);
      const bystander = await seedContact(a, accountA, `ok-${fx.run}`);
      const config = await fx.prisma.assistantConfig.create({
        data: { projectId: a.projectId, organizationId: a.organizationId },
      });
      await fx.prisma.assistantSession.create({
        data: {
          assistantConfigId: config.id,
          organizationId: a.organizationId,
          externalUserId: victim.contact.externalId,
        },
      });
      await fx.prisma.assistantSession.create({
        data: {
          assistantConfigId: config.id,
          organizationId: a.organizationId,
          externalUserId: bystander.contact.externalId,
        },
      });

      const report = await svc.eraseContact(
        a.organizationId,
        victim.contact.id,
      );
      expect(report).toMatchObject({
        conversationsDeleted: 1,
        messagesDeleted: 2,
        sessionsDeleted: 1,
      });

      expect(
        await fx.prisma.contact.findUnique({
          where: { id: victim.contact.id },
        }),
      ).toBeNull();
      expect(
        await fx.prisma.conversation.count({ where: { id: victim.conv.id } }),
      ).toBe(0);
      expect(
        await fx.prisma.message.count({
          where: { conversationId: victim.conv.id },
        }),
      ).toBe(0);

      // el otro ciudadano de la misma organización queda intacto
      expect(
        await fx.prisma.contact.count({ where: { id: bystander.contact.id } }),
      ).toBe(1);
      expect(
        await fx.prisma.message.count({
          where: { conversationId: bystander.conv.id },
        }),
      ).toBe(2);
      expect(
        await fx.prisma.assistantSession.count({
          where: { externalUserId: bystander.contact.externalId },
        }),
      ).toBe(1);
    });

    it('AISLAMIENTO: otra organización no puede suprimir ese contacto', async () => {
      const mine = await seedContact(a, accountA, `prot-${fx.run}`);
      await expect(
        svc.eraseContact(b.organizationId, mine.contact.id),
      ).rejects.toThrow(NotFoundException);
      expect(
        await fx.prisma.contact.count({ where: { id: mine.contact.id } }),
      ).toBe(1);
      expect(
        await fx.prisma.message.count({
          where: { conversationId: mine.conv.id },
        }),
      ).toBe(2);
    });

    it('un contacto inexistente → 404', async () => {
      await expect(
        svc.eraseContact(a.organizationId, 'no-existe'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('retención', () => {
    afterEach(() => {
      delete process.env['SESSION_RETENTION_DAYS'];
      delete process.env['MESSAGE_RETENTION_DAYS'];
    });

    it('borra sesiones vencidas y conserva las recientes', async () => {
      process.env['SESSION_RETENTION_DAYS'] = '30';
      const config = await fx.prisma.assistantConfig.findFirstOrThrow({
        where: { organizationId: a.organizationId },
      });
      const old = await fx.prisma.assistantSession.create({
        data: {
          assistantConfigId: config.id,
          organizationId: a.organizationId,
          externalUserId: `old-${fx.run}`,
          lastMessageAt: new Date(Date.now() - 60 * 86_400_000),
        },
      });
      const oldNeverUsed = await fx.prisma.assistantSession.create({
        data: {
          assistantConfigId: config.id,
          organizationId: a.organizationId,
          externalUserId: `old2-${fx.run}`,
          createdAt: new Date(Date.now() - 60 * 86_400_000),
        },
      });
      const recent = await fx.prisma.assistantSession.create({
        data: {
          assistantConfigId: config.id,
          organizationId: a.organizationId,
          externalUserId: `new-${fx.run}`,
          lastMessageAt: new Date(),
        },
      });

      const report = await svc.purgeExpired();
      expect(report.sessionsDeleted).toBeGreaterThanOrEqual(2);
      expect(
        await fx.prisma.assistantSession.count({
          where: { id: { in: [old.id, oldNeverUsed.id] } },
        }),
      ).toBe(0);
      expect(
        await fx.prisma.assistantSession.count({ where: { id: recent.id } }),
      ).toBe(1);
    });

    it('los mensajes NO se borran salvo que MESSAGE_RETENTION_DAYS esté configurado', async () => {
      const seed = await seedContact(a, accountA, `msg-${fx.run}`);
      await fx.prisma.message.updateMany({
        where: { conversationId: seed.conv.id },
        data: { createdAt: new Date(Date.now() - 400 * 86_400_000) },
      });

      await svc.purgeExpired();
      expect(
        await fx.prisma.message.count({
          where: { conversationId: seed.conv.id },
        }),
      ).toBe(2); // por defecto: se conservan

      process.env['MESSAGE_RETENTION_DAYS'] = '365';
      await svc.purgeExpired();
      expect(
        await fx.prisma.message.count({
          where: { conversationId: seed.conv.id },
        }),
      ).toBe(0);
      expect(
        await fx.prisma.conversation.count({ where: { id: seed.conv.id } }),
      ).toBe(1); // el hilo queda, sin contenido
    });
  });
});
