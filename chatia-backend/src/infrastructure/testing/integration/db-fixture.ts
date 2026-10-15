// Fixture para tests de integración contra un Postgres REAL (TEST_DATABASE_URL).
// NUNCA apuntar a una base con datos reales: los tests crean y borran filas (con prefijo aleatorio por corrida).
import { randomBytes } from 'node:crypto';
import { PrismaService } from '@/infrastructure/prisma/prisma.service.js';

export const TEST_DATABASE_URL = process.env['TEST_DATABASE_URL'];

/** `describe` real solo si hay base de pruebas; si no, se saltea (CI sin Postgres, desarrollo sin servicios). */
export const describeDb = TEST_DATABASE_URL ? describe : describe.skip;

export interface Tenant {
  ecosystemId: string;
  organizationId: string;
  projectId: string;
  projectSlug: string;
  kbId: string;
}

export class DbFixture {
  readonly run = randomBytes(4).toString('hex');
  prisma!: PrismaService;
  private readonly ecosystems: string[] = [];
  private readonly organizations: string[] = [];

  async connect(): Promise<void> {
    if (!TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL no definido');
    process.env['DATABASE_URL'] = TEST_DATABASE_URL; // PrismaService lo lee al construirse
    this.prisma = new PrismaService();
    await this.prisma.onModuleInit();
  }

  /** Crea un ecosistema + organización + proyecto + base de conocimiento aislados. */
  async tenant(label: string): Promise<Tenant> {
    const id = `it_${this.run}_${label}`;
    const eco = await this.prisma.ecosystem.create({
      data: { id: `${id}_eco`, firebaseProjectId: `${id}_fb`, name: id },
    });
    const org = await this.prisma.organization.create({
      data: { id: `${id}_org`, ecosystemId: eco.id, name: id },
    });
    const project = await this.prisma.project.create({
      data: {
        id: `${id}_prj`,
        organizationId: org.id,
        slug: `prj-${label}`,
        name: label,
      },
    });
    const kb = await this.prisma.knowledgeBase.create({
      data: {
        id: `${id}_kb`,
        projectId: project.id,
        organizationId: org.id,
        name: `kb-${label}`,
      },
    });
    this.ecosystems.push(eco.id);
    this.organizations.push(org.id);
    return {
      ecosystemId: eco.id,
      organizationId: org.id,
      projectId: project.id,
      projectSlug: project.slug,
      kbId: kb.id,
    };
  }

  /** Borra todo lo creado por esta corrida (orden por claves foráneas). */
  async cleanup(): Promise<void> {
    if (!this.prisma) return;
    const orgs = this.organizations;
    await this.prisma.kbChunk.deleteMany({
      where: { document: { organizationId: { in: orgs } } },
    });
    await this.prisma.kbDocument.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await this.prisma.knowledgeBase.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await this.prisma.channelAccount.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await this.prisma.project.deleteMany({
      where: { organizationId: { in: orgs } },
    });
    await this.prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    await this.prisma.ecosystem.deleteMany({
      where: { id: { in: this.ecosystems } },
    });
    await this.prisma.onModuleDestroy();
  }
}

/** Vector determinista de 1024 dims a partir del texto: mismas palabras → vectores parecidos (sin red). */
export function fakeEmbedding(text: string, dim = 1024): number[] {
  const v = new Array<number>(dim).fill(0);
  for (const word of text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2)) {
    let h = 0;
    for (const ch of word) h = (h * 31 + ch.charCodeAt(0)) % dim;
    v[h] = (v[h] ?? 0) + 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
