/**
 * Tests e2e — Firebase SSO + permisos por producto (modelo vigente)
 *
 * Este sistema NO gestiona users ni orgs (los gestiona owner-dashboard):
 * el acceso se decide por los claims custom del token Firebase
 * (`organizations`, `productPermissions.payments`) + header `x-organization-id`.
 *
 * Firebase Admin está mockeado. Requiere DATABASE_URL de test.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '@/app.module.js';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';
import { AllExceptionsFilter } from '@/infrastructure/common/filters/all-exceptions.filter.js';
import { FIREBASE_ADMIN } from '@/infrastructure/firebase/firebase.module.js';

const mockVerifyIdToken = jest.fn();

// getAuth(app).verifyIdToken(...) → mockVerifyIdToken
jest.mock('firebase-admin/auth', () => ({
  getAuth: jest.fn(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;

  const FIREBASE_UID = 'firebase_uid_test_123';
  const USER_EMAIL   = 'test@pasarela.com';
  const RAW_API_KEY  = 'e2e-auth-api-key';

  const claims = (canWrite: boolean) => ({
    uid:                FIREBASE_UID,
    email:              USER_EMAIL,
    organizations:      [tenantId],
    productPermissions: { payments: { canRead: true, canWrite } },
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(FIREBASE_ADMIN)
      .useValue({ name: '[DEFAULT]' })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // Tenant === organizationId en esta pasarela
    const hash = await bcrypt.hash(RAW_API_KEY, 10);
    const tenant = await prisma.tenant.create({
      data: { name: 'Auth E2E Tenant', apiKeyHash: hash, active: true },
    });
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  beforeEach(() => {
    mockVerifyIdToken.mockResolvedValue(claims(true));
  });

  afterEach(() => jest.clearAllMocks());

  describe('GET /api/v1/auth/me', () => {
    it('retorna el contexto de la org con Bearer válido', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-firebase-token')
        .set('x-organization-id', tenantId)
        .expect(200);

      expect(res.body.organizationId).toBe(tenantId);
      expect(res.body.userId).toBe(FIREBASE_UID);
      expect(res.body.canWrite).toBe(true);
      expect(res.body.product).toBe('payments');
    });

    it('401 sin token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('401 con token Firebase inválido', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token inválido'));
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .set('x-organization-id', tenantId)
        .expect(401);
    });

    it('403 si el usuario no pertenece a la org solicitada', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer valid-firebase-token')
        .set('x-organization-id', 'otra-org')
        .expect(403);
    });
  });

  describe('Auth dual: x-api-key sigue funcionando', () => {
    it('acepta x-api-key (retrocompatibilidad B2B)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .set('x-api-key', RAW_API_KEY)
        .expect(200);

      expect(res.body).toHaveProperty('data');
    });
  });

  describe('Permisos de escritura (productPermissions.payments)', () => {
    const body = {
      amountMinor: 1000,
      currency:    'ARS',
      country:     'AR',
      method:      'card',
      customerId:  'cust_rbac',
    };

    it('sin canWrite no puede crear pagos (403)', async () => {
      mockVerifyIdToken.mockResolvedValue(claims(false));

      await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', 'Bearer valid-token')
        .set('x-organization-id', tenantId)
        .set('idempotency-key', 'rbac-test-key')
        .send(body)
        .expect(403);
    });

    it('con canWrite puede crear pagos', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', 'Bearer valid-token')
        .set('x-organization-id', tenantId)
        .set('idempotency-key', 'rbac-admin-key')
        .send(body);

      expect([201, 400]).toContain(res.status); // 201 ok, 400 si el provider fake no está disponible
    });
  });
});
