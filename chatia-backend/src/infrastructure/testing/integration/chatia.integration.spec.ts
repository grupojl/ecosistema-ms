// Integración contra Postgres REAL: TEST_DATABASE_URL=postgresql://... pnpm test
// (se saltea sola si la variable no está definida). Cubre lo que los mocks no pueden: SQL real,
// restricciones, migraciones, aislamiento entre tenants y el pipeline de indexación de punta a punta.
import { createHmac, randomBytes } from 'node:crypto';
import { TokenCipher } from '@/infrastructure/security/token-cipher.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pg from 'pg';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { EcosystemService } from '@/core/ecosystem/ecosystem.service.js';
import { TenantAuthService } from '@/infrastructure/common/services/tenant-auth.service.js';
import {
  DbFixture,
  describeDb,
  fakeEmbedding,
  TEST_DATABASE_URL,
  type Tenant,
} from '@/infrastructure/testing/integration/db-fixture.js';
import { FaqIndexerService } from '@/core/faq/ingestion/faq-indexer.service.js';
import { FaqQueryService } from '@/core/faq/query/faq-query.service.js';
import { KbVectorStore } from '@/core/faq/vector/kb-vector.store.js';
import { KnowledgeBaseService } from '@/core/faq/knowledge-base/knowledge-base.service.js';
import { KbDocumentService } from '@/core/faq/document/kb-document.service.js';
import { ChannelAccountsService } from '@/core/channel-accounts/channel-accounts.service.js';
import { WebhooksService } from '@/core/webhooks/webhooks.service.js';
import { WhatsAppChannel } from '@/infrastructure/channels/whatsapp/whatsapp.channel.js';
import { PrismaKnowledgeRepository } from '@/infrastructure/prisma/repositories/prisma-knowledge.repository.js';
import { PrismaKbVectorRepository } from '@/infrastructure/prisma/repositories/prisma-kb-vector.repository.js';
import { PrismaChannelAccountsRepository } from '@/infrastructure/prisma/repositories/prisma-channel-accounts.repository.js';
import { PrismaEcosystemsRepository } from '@/infrastructure/prisma/repositories/prisma-ecosystems.repository.js';
import { PrismaOrganizationsRepository } from '@/infrastructure/prisma/repositories/prisma-organizations.repository.js';
import { HealthController } from '@/infrastructure/transport/health/health.controller.js';

describeDb('chatia-backend — integración con Postgres real', () => {
  const fx = new DbFixture();
  // repositories Prisma reales sobre la base de pruebas
  const knowledge = (): PrismaKnowledgeRepository =>
    new PrismaKnowledgeRepository(fx.prisma);
  const accountsRepo = (): PrismaChannelAccountsRepository =>
    new PrismaChannelAccountsRepository(fx.prisma);
  const newEcosystemService = (): EcosystemService =>
    new EcosystemService(
      new PrismaEcosystemsRepository(fx.prisma),
      new PrismaOrganizationsRepository(fx.prisma),
    );
  let a: Tenant;
  let b: Tenant;

  const embedding = {
    modelName: 'fake-1024',
    embed: (t: string) => Promise.resolve(fakeEmbedding(t)),
    embedMany: (ts: string[]) =>
      Promise.resolve(ts.map((t) => fakeEmbedding(t))),
    cosineSimilarity: (x: number[], y: number[]) =>
      x.reduce((s, v, i) => s + v * (y[i] ?? 0), 0),
  };

  beforeAll(async () => {
    await fx.connect();
    a = await fx.tenant('a');
    b = await fx.tenant('b');
  }, 30_000);

  afterAll(async () => {
    await fx.cleanup();
  }, 30_000);

  describe('migraciones', () => {
    it('la migración de pgvector es idempotente y no falla aunque no exista la extensión', async () => {
      const sql = readFileSync(
        join(
          __dirname,
          '../../../../prisma/migrations/20261014000000_kbchunk_pgvector/migration.sql',
        ),
        'utf8',
      );
      const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await client.connect();
      try {
        await client.query(sql);
        await client.query(sql); // segunda vez: sigue sin fallar
      } finally {
        await client.end();
      }
    });

    it('KbChunk tiene embeddingModel; embeddingVec existe solo si hay pgvector', async () => {
      const cols = await fx.prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'KbChunk'`;
      const names = cols.map((c) => c.column_name);
      expect(names).toContain('embeddingModel');
      const ext = await fx.prisma.$queryRaw<
        unknown[]
      >`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
      expect(names.includes('embeddingVec')).toBe(ext.length > 0);
    });
  });

  describe('indexación y búsqueda de la FAQ (punta a punta)', () => {
    const store = (): KbVectorStore =>
      new KbVectorStore(new PrismaKbVectorRepository(fx.prisma));
    const indexer = (): FaqIndexerService =>
      new FaqIndexerService(knowledge(), embedding as never, store());
    const query = (): FaqQueryService =>
      new FaqQueryService(knowledge(), embedding as never, store());

    it('indexa un documento: PROCESSING → INDEXED con fragmentos persistidos', async () => {
      const doc = await fx.prisma.kbDocument.create({
        data: {
          knowledgeBaseId: a.kbId,
          organizationId: a.organizationId,
          title: 'Registro de conducir',
          sourceType: 'TEXT',
          status: 'PENDING',
          rawContent:
            'Para renovar el registro de conducir se necesita DNI y certificado de salud.\n\n' +
            'El horario de atención del área de tránsito es de lunes a viernes de 8 a 14.',
        },
      });
      const res = await indexer().indexDocument(doc.id, a.organizationId);
      expect(res.chunks).toBeGreaterThan(0);

      const saved = await fx.prisma.kbDocument.findUniqueOrThrow({
        where: { id: doc.id },
      });
      expect(saved).toMatchObject({
        status: 'INDEXED',
        chunkCount: res.chunks,
        errorMessage: null,
      });
      expect(saved.indexedAt).not.toBeNull();
      const chunks = await fx.prisma.kbChunk.findMany({
        where: { documentId: doc.id },
      });
      expect(chunks).toHaveLength(res.chunks);
      expect(chunks[0]!.embeddingModel).toBe('fake-1024');
    });

    it('la consulta encuentra el fragmento correcto (semántico o por texto)', async () => {
      const hits = await query().search(
        a.kbId,
        'cómo renovar el registro de conducir',
        3,
        a.organizationId,
      );
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.content.toLowerCase()).toContain('registro');
    });

    it('reindexar reemplaza los fragmentos (no los duplica)', async () => {
      const doc = await fx.prisma.kbDocument.findFirstOrThrow({
        where: { knowledgeBaseId: a.kbId },
      });
      await indexer().indexDocument(doc.id, a.organizationId);
      await indexer().indexDocument(doc.id, a.organizationId);
      const n = await fx.prisma.kbChunk.count({
        where: { documentId: doc.id },
      });
      expect(n).toBe(doc.chunkCount || n);
      expect(n).toBeLessThan(10);
    });

    it('AISLAMIENTO: la organización B no puede indexar ni buscar documentos de A', async () => {
      const doc = await fx.prisma.kbDocument.findFirstOrThrow({
        where: { knowledgeBaseId: a.kbId },
      });
      await expect(
        indexer().indexDocument(doc.id, b.organizationId),
      ).rejects.toThrow(NotFoundException);
      expect(
        await query().search(
          a.kbId,
          'registro de conducir',
          5,
          b.organizationId,
        ),
      ).toEqual([]);
    });

    it('un documento que falla queda FAILED con el motivo (no se queda en PROCESSING)', async () => {
      const doc = await fx.prisma.kbDocument.create({
        data: {
          knowledgeBaseId: a.kbId,
          organizationId: a.organizationId,
          title: 'vacío',
          sourceType: 'TEXT',
          status: 'PENDING',
          rawContent: '   ',
        },
      });
      await expect(
        indexer().indexDocument(doc.id, a.organizationId),
      ).rejects.toThrow();
      await indexer().markFailed(
        doc.id,
        a.organizationId,
        'El documento no tiene texto',
      );
      expect(
        await fx.prisma.kbDocument.findUniqueOrThrow({ where: { id: doc.id } }),
      ).toMatchObject({
        status: 'FAILED',
        errorMessage: 'El documento no tiene texto',
      });
    });

    it('con pgvector disponible: guarda en la columna indexada y la búsqueda usa el índice', async () => {
      const s = store();
      if (!(await s.isAvailable())) return; // Postgres sin pgvector: el respaldo ya se probó arriba
      const doc = await fx.prisma.kbDocument.findFirstOrThrow({
        where: { knowledgeBaseId: a.kbId, status: 'INDEXED' },
      });
      const hits = await s.search(
        a.kbId,
        fakeEmbedding('registro de conducir DNI'),
        3,
        a.organizationId,
      );
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.documentId).toBe(doc.id);
      expect(
        await s.search(a.kbId, fakeEmbedding('registro'), 3, b.organizationId),
      ).toEqual([]);
    });
  });

  describe('aislamiento entre organizaciones (SQL real)', () => {
    it('KnowledgeBaseService: no se puede crear ni leer una KB de otra organización', async () => {
      const svc = new KnowledgeBaseService(knowledge());
      await expect(
        svc.create(a.projectId, b.organizationId, { name: 'intruso' } as never),
      ).rejects.toThrow(NotFoundException);
      await expect(svc.findOne(a.kbId, b.organizationId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(svc.remove(a.kbId, b.organizationId)).rejects.toThrow(
        NotFoundException,
      );
      expect((await svc.findOne(a.kbId, a.organizationId)).id).toBe(a.kbId);
    });

    it('KbDocumentService: no se puede crear un documento en la KB de otra organización', async () => {
      const svc = new KbDocumentService(knowledge(), null);
      await expect(
        svc.create(a.kbId, b.organizationId, {
          title: 'x',
          sourceType: 'TEXT',
          rawContent: 'x',
          tags: [],
        } as never),
      ).rejects.toThrow(NotFoundException);
    });

    it('ChannelAccountsService: crea, no filtra secretos y no cruza organizaciones', async () => {
      const cipher = TokenCipher.fromEnv({
        CHANNEL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      });
      const svc = new ChannelAccountsService(accountsRepo(), cipher);
      const created = await svc.create(a.organizationId, {
        channelType: 'WHATSAPP',
        name: 'Muni',
        externalId: `pn-${fx.run}`,
        accessToken: 'EAAG-secreto',
        extraConfig: { appSecret: 'app-secret', wabaId: '1' },
      } as never);
      expect(JSON.stringify(created)).not.toMatch(/EAAG-secreto|app-secret/);
      const id = created.data.id;

      expect(
        (await svc.list(b.organizationId)).data.find((x) => x.id === id),
      ).toBeUndefined();
      await expect(svc.findOne(id, b.organizationId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        svc.update(id, b.organizationId, { name: 'robo' }),
      ).rejects.toThrow(NotFoundException);

      // El secreto se conserva en la base aunque nunca se devuelve
      await svc.update(id, a.organizationId, { extraConfig: { wabaId: '2' } });
      const row = await fx.prisma.channelAccount.findUniqueOrThrow({
        where: { id },
      });
      expect(row.extraConfig).toMatchObject({ wabaId: '2' });
      // En la base: cifrados, nunca en claro
      expect(row.accessToken).toMatch(/^enc:v1:/);
      expect(JSON.stringify(row)).not.toMatch(/EAAG-secreto|"app-secret"/);
      expect(
        cipher.decrypt((row.extraConfig as { appSecret: string }).appSecret),
      ).toBe('app-secret');
    });
  });

  describe('aislamiento ENTRE ECOSISTEMAS (SQL real)', () => {
    it('un ecosistema no puede apropiarse de una organización de otro ecosistema', async () => {
      const svc = newEcosystemService();
      await expect(
        svc.ensureOrganization(b.ecosystemId, a.organizationId, 'ROBADA'),
      ).rejects.toThrow(ForbiddenException);
      const org = await fx.prisma.organization.findUniqueOrThrow({
        where: { id: a.organizationId },
      });
      expect(org.name).not.toBe('ROBADA');
      expect(org.ecosystemId).toBe(a.ecosystemId);
    });

    it('TenantAuthService: un token del ecosistema B con el organizationId de A es rechazado', async () => {
      const claimsFor = (orgId: string) => ({
        uid: `uid-${fx.run}`,
        aud: `${b.ecosystemId.replace('_eco', '')}_fb`,
        email: 'x@y.z',
        name: 'X',
        organizationId: orgId,
        organizationName: 'Org',
        role: 'ADMIN',
        permissions: { chat: { canRead: true, canWrite: true } },
      });
      const firebase = {
        isInitialized: true,
        verifyIdToken: jest.fn().mockResolvedValue(claimsFor(a.organizationId)),
      };
      const auth = new TenantAuthService(
        firebase as never,
        newEcosystemService(),
        fx.prisma,
      );

      await expect(
        auth.authenticate({
          authorization: 'Bearer t',
          organizationId: a.organizationId,
        }),
      ).rejects.toThrow(/otro ecosistema/);

      // y con su PROPIA organización sí entra
      firebase.verifyIdToken.mockResolvedValue(claimsFor(b.organizationId));
      const ctx = await auth.authenticate({
        authorization: 'Bearer t',
        organizationId: b.organizationId,
      });
      expect(ctx).toMatchObject({
        ecosystemId: b.ecosystemId,
        organizationId: b.organizationId,
      });
      await fx.prisma.agent.deleteMany({
        where: { firebaseUid: `uid-${fx.run}` },
      });
    });

    it('un uid de agente que ya existe en otro ecosistema no se reutiliza', async () => {
      const uid = `uid-colision-${fx.run}`;
      const agentA = await fx.prisma.agent.create({
        data: {
          firebaseUid: uid,
          organizationId: a.organizationId,
          name: 'Agente A',
          email: `a-${fx.run}@x.z`,
          role: 'AGENT',
        },
      });
      const decoded = {
        uid,
        aud: `${b.ecosystemId.replace('_eco', '')}_fb`,
        email: 'otro@x.z',
        name: 'Impostor',
        organizationId: b.organizationId,
        organizationName: 'B',
        role: 'ADMIN',
        permissions: { chat: { canRead: true, canWrite: true } },
      };
      const firebase = {
        isInitialized: true,
        verifyIdToken: jest.fn().mockResolvedValue(decoded),
      };
      const auth = new TenantAuthService(
        firebase as never,
        newEcosystemService(),
        fx.prisma,
      );

      await expect(
        auth.authenticate({
          authorization: 'Bearer t',
          organizationId: b.organizationId,
        }),
      ).rejects.toThrow(/otro ecosistema/);
      const unchanged = await fx.prisma.agent.findUniqueOrThrow({
        where: { id: agentA.id },
      });
      expect(unchanged).toMatchObject({
        name: 'Agente A',
        organizationId: a.organizationId,
      });
      await fx.prisma.agent.delete({ where: { id: agentA.id } });
    });
  });

  describe('webhooks con firma, contra cuentas reales', () => {
    const SECRET = 'meta-app-secret-integracion';
    const body = (id: string): Buffer =>
      Buffer.from(
        JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      {
                        id,
                        from: '5491100000000',
                        type: 'text',
                        text: { body: 'hola' },
                        timestamp: '1700000000',
                      },
                    ],
                    contacts: [{ profile: { name: 'Ana' } }],
                  },
                },
              ],
            },
          ],
        }),
      );
    const sign = (buf: Buffer): string =>
      `sha256=${createHmac('sha256', SECRET).update(buf).digest('hex')}`;
    const queue = { add: jest.fn() };
    let externalId: string;
    let service: WebhooksService;

    beforeAll(async () => {
      externalId = `wh-${fx.run}`;
      await fx.prisma.channelAccount.create({
        data: {
          organizationId: a.organizationId,
          channelType: 'WHATSAPP',
          name: 'wh',
          externalId,
          accessToken: 't',
        },
      });
      const registry = { get: () => new WhatsAppChannel() };
      service = new WebhooksService(
        accountsRepo(),
        registry as never,
        queue as never,
        TokenCipher.fromEnv({}),
      );
      process.env['META_APP_SECRET'] = SECRET;
    });

    afterAll(() => {
      delete process.env['META_APP_SECRET'];
    });
    beforeEach(() => queue.add.mockClear());

    it('firma válida → encola con jobId idempotente', async () => {
      const buf = body('wamid.int.1');
      await service.handleEvent(
        'WHATSAPP',
        externalId,
        JSON.parse(buf.toString()),
        buf,
        sign(buf),
      );
      expect(queue.add).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ channelType: 'WHATSAPP' }),
        expect.objectContaining({
          jobId: expect.stringContaining('wamid.int.1'),
        }),
      );
    });

    it('sin firma o con firma ajena → 401 y no encola', async () => {
      const buf = body('wamid.int.2');
      await expect(
        service.handleEvent('WHATSAPP', externalId, {}, buf, undefined),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.handleEvent(
          'WHATSAPP',
          externalId,
          {},
          buf,
          sign(Buffer.from('otro')),
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('cuenta inexistente → 401', async () => {
      const buf = body('wamid.int.3');
      await expect(
        service.handleEvent('WHATSAPP', 'no-existe', {}, buf, sign(buf)),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('salud con base real', () => {
    it('/health/ready responde OK con Postgres vivo (Redis deshabilitado por configuración)', async () => {
      process.env['REDIS_ENABLED'] = 'false';
      const ctl = new HealthController(
        fx.prisma,
        { getAll: () => Promise.resolve({}) } as never,
        {} as never,
        {} as never,
      );
      await expect(ctl.ready()).resolves.toMatchObject({
        status: 'ok',
        db: true,
      });
      expect((await ctl.check()).db).toBe(true);
    });
  });
});
