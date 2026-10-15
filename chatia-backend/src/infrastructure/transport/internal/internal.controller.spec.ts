// /internal/* por HTTP con el guard REAL: lo que ve grupojl-control (superadmin) y lo que ve un atacante sin la clave.
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { InternalController } from '@/infrastructure/transport/internal/internal.controller.js';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';

const KEY = 'clave-interna-de-prueba';

describe('InternalController (HTTP, guard real)', () => {
  let app: INestApplication;
  const prisma = {
    conversation: { findMany: jest.fn(), count: jest.fn() },
  };
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];
  const authed = (path: string) =>
    request(server()).get(path).set('x-internal-api-key', KEY);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => (k === 'INTERNAL_API_KEY' ? KEY : undefined),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.conversation.count.mockResolvedValue(0);
  });

  describe('seguridad', () => {
    it.each([
      '/internal/conversations/escalated',
      '/internal/conversations/stats?ecosystemId=e1',
    ])(
      '%s sin clave o con clave incorrecta → 403 y no toca la base',
      async (p) => {
        await request(server()).get(p).expect(403);
        await request(server())
          .get(p)
          .set('x-internal-api-key', 'otra')
          .expect(403);
        await request(server()).get(p).set('x-api-key', KEY).expect(403); // el header legacy exige SU propia variable
        expect(prisma.conversation.findMany).not.toHaveBeenCalled();
        expect(prisma.conversation.count).not.toHaveBeenCalled();
      },
    );
  });

  describe('GET /internal/conversations/escalated', () => {
    it('aplica los valores por defecto (60 min, 50 resultados) y no filtra por ecosistema si no se pide', async () => {
      jest.useFakeTimers({
        now: new Date('2026-10-15T12:00:00Z'),
        doNotFake: ['nextTick', 'setImmediate'],
      });
      await authed('/internal/conversations/escalated').expect(200);
      const arg = prisma.conversation.findMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
        take: number;
        orderBy: unknown;
      };
      expect(arg.take).toBe(50);
      expect(arg.orderBy).toEqual({ updatedAt: 'asc' });
      expect(arg.where).toMatchObject({
        status: 'OPEN',
        assignedAgentId: null,
        updatedAt: { lt: new Date('2026-10-15T11:00:00Z') },
      });
      expect(arg.where).not.toHaveProperty('channelAccount');
    });

    it('con ecosystemId acota por ecosistema; minutos y límite se respetan', async () => {
      jest.useFakeTimers({
        now: new Date('2026-10-15T12:00:00Z'),
        doNotFake: ['nextTick', 'setImmediate'],
      });
      await authed(
        '/internal/conversations/escalated?ecosystemId=eco-1&minutesWithoutResponse=10&limit=5',
      ).expect(200);
      const arg = prisma.conversation.findMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
        take: number;
      };
      expect(arg.take).toBe(5);
      expect(arg.where).toMatchObject({
        channelAccount: { organization: { ecosystemId: 'eco-1' } },
        updatedAt: { lt: new Date('2026-10-15T11:50:00Z') },
      });
    });

    it('mapea la respuesta: minutos de espera, canal, tenant y "Sin nombre" si no hay contacto', async () => {
      jest.useFakeTimers({
        now: new Date('2026-10-15T12:00:00Z'),
        doNotFake: ['nextTick', 'setImmediate'],
      });
      prisma.conversation.findMany.mockResolvedValue([
        {
          id: 'c1',
          updatedAt: new Date('2026-10-15T10:30:00Z'),
          contact: { name: 'Ana' },
          channelAccount: {
            channelType: 'WHATSAPP',
            organizationId: 'org-1',
            organization: { ecosystemId: 'eco-1' },
          },
        },
        {
          id: 'c2',
          updatedAt: new Date('2026-10-15T11:59:30Z'),
          contact: null,
          channelAccount: {
            channelType: 'INSTAGRAM',
            organizationId: 'org-2',
            organization: { ecosystemId: 'eco-2' },
          },
        },
      ]);
      const res = await authed('/internal/conversations/escalated').expect(200);
      expect(res.body).toEqual([
        {
          id: 'c1',
          ecosystemId: 'eco-1',
          organizationId: 'org-1',
          channel: 'WHATSAPP',
          contactName: 'Ana',
          agentName: null,
          lastMessageAt: '2026-10-15T10:30:00.000Z',
          minutesWaiting: 90,
        },
        {
          id: 'c2',
          ecosystemId: 'eco-2',
          organizationId: 'org-2',
          channel: 'INSTAGRAM',
          contactName: 'Sin nombre',
          agentName: null,
          lastMessageAt: '2026-10-15T11:59:30.000Z',
          minutesWaiting: 0,
        },
      ]);
    });

    it.each([
      'limit=0',
      'limit=201',
      'limit=abc',
      'minutesWithoutResponse=0',
      'minutesWithoutResponse=-5',
      'minutesWithoutResponse=1.5',
    ])('parámetros inválidos (%s) → 400 y no consulta la base', async (qs) => {
      await authed(`/internal/conversations/escalated?${qs}`).expect(400);
      expect(prisma.conversation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('GET /internal/conversations/stats', () => {
    it('exige ecosystemId y fechas ISO válidas', async () => {
      await authed('/internal/conversations/stats').expect(400);
      await authed(
        '/internal/conversations/stats?ecosystemId=e1&from=ayer',
      ).expect(400);
      await authed(
        '/internal/conversations/stats?ecosystemId=e1&to=2026-13-45',
      ).expect(400);
      expect(prisma.conversation.count).not.toHaveBeenCalled();
    });

    it('cuenta SIEMPRE acotado al ecosistema pedido (total, resueltas y sin atender)', async () => {
      prisma.conversation.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(2);
      const res = await authed(
        '/internal/conversations/stats?ecosystemId=eco-9',
      ).expect(200);
      expect(res.body).toEqual({
        total: 10,
        resolved: 6,
        escalated: 2,
        avgResponseMinutes: 0,
      });
      const wheres = prisma.conversation.count.mock.calls.map(
        (c) => (c[0] as { where: Record<string, unknown> }).where,
      );
      expect(wheres).toHaveLength(3);
      for (const w of wheres) {
        expect(w).toMatchObject({
          channelAccount: { organization: { ecosystemId: 'eco-9' } },
        });
        expect(w).not.toHaveProperty('createdAt');
      }
      expect(wheres[1]).toMatchObject({ status: 'RESOLVED' });
      expect(wheres[2]).toMatchObject({
        status: 'OPEN',
        assignedAgentId: null,
      });
    });

    it('con rango de fechas: from, to o ambos se aplican como gte/lte', async () => {
      const from = '2026-10-01T00:00:00.000Z';
      const to = '2026-10-31T23:59:59.000Z';
      await authed(
        `/internal/conversations/stats?ecosystemId=e&from=${from}`,
      ).expect(200);
      await authed(
        `/internal/conversations/stats?ecosystemId=e&to=${to}`,
      ).expect(200);
      await authed(
        `/internal/conversations/stats?ecosystemId=e&from=${from}&to=${to}`,
      ).expect(200);
      const created = prisma.conversation.count.mock.calls
        .filter((_c, i) => i % 3 === 0)
        .map((c) => (c[0] as { where: { createdAt: object } }).where.createdAt);
      expect(created).toEqual([
        { gte: new Date(from) },
        { lte: new Date(to) },
        { gte: new Date(from), lte: new Date(to) },
      ]);
    });
  });
});
