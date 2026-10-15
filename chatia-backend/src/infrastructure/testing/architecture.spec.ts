// Reglas de arquitectura (.claude/architecture/01-capas-microservicio.md) hechas test para que no se erosionen.
//  1. core/ no tiene controllers: la API HTTP vive en modules/.
//  2. core/ no conoce modules/ (la dependencia va de modules → core, nunca al revés).
//  3. Un ecosistema (modules/<eco>) no importa de otro ecosistema ni de modules/common.
//  4. modules/common no importa de ningún ecosistema.
//  5. La raíz de src/ solo tiene core/, infrastructure/, modules/ (+ main.ts, app.module.ts y generated/ de Prisma).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..');

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === 'node_modules' || name === 'generated') return [];
    if (statSync(full).isDirectory()) return files(full);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [full] : [];
  });

const rel = (f: string) => relative(SRC, f).replace(/\\/g, '/');
const importsOf = (f: string): string[] =>
  [...readFileSync(f, 'utf8').matchAll(/from\s+'(@\/[^']+)'/g)].map(
    (m) => m[1],
  );

const ECOSYSTEMS = readdirSync(join(SRC, 'modules')).filter(
  (n) => n !== 'common' && statSync(join(SRC, 'modules', n)).isDirectory(),
);

describe('arquitectura: core / modules / infrastructure', () => {
  it('hay ecosistemas para validar', () => {
    expect(ECOSYSTEMS).toEqual(
      expect.arrayContaining(['welver', 'manzana', 'mexus']),
    );
  });

  it('la raíz de src/ solo tiene core, infrastructure y modules', () => {
    const allowed = new Set([
      'core',
      'infrastructure',
      'modules',
      'generated',
      'main.ts',
      'app.module.ts',
    ]);
    const extra = readdirSync(SRC).filter((n) => !allowed.has(n));
    expect(extra).toEqual([]);
  });

  it('core/ no tiene controllers (la API HTTP vive en modules/)', () => {
    const offenders = files(join(SRC, 'core')).filter((f) =>
      /@Controller\(/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it('core/ no importa de modules/', () => {
    const offenders = files(join(SRC, 'core')).filter((f) =>
      importsOf(f).some((i) => i.startsWith('@/modules/')),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it.each(ECOSYSTEMS)(
    'modules/%s solo importa de sí mismo dentro de modules/',
    (eco) => {
      const offenders = files(join(SRC, 'modules', eco)).filter((f) =>
        importsOf(f).some(
          (i) =>
            i.startsWith('@/modules/') && !i.startsWith(`@/modules/${eco}/`),
        ),
      );
      expect(offenders.map(rel)).toEqual([]);
    },
  );

  it('modules/common no importa de ningún ecosistema', () => {
    const offenders = files(join(SRC, 'modules', 'common')).filter((f) =>
      importsOf(f).some((i) =>
        ECOSYSTEMS.some((eco) => i.startsWith(`@/modules/${eco}/`)),
      ),
    );
    expect(offenders.map(rel)).toEqual([]);
  });
});

// ── TRINQUETE (ratchet) ──────────────────────────────────────────────────────────────────────────────────────
// PrismaService: regla estricta (0 archivos) desde 2026-10-15 — todo pasa por repositories.
// queue/channels/events: deuda conocida. La lista INFRA_DEBT SOLO puede achicarse: un archivo nuevo que rompa la
// regla falla, y uno ya corregido debe salir de la lista (el test lo exige). Meta: lista vacía (colas detrás de un puerto).
const INFRA_DEBT = new Set([
  'assistant/assistant.module.ts',
  'assistant/chat/assistant-chat.service.ts',
  'assistant/processors/assistant-chat.processor.ts',
  'conversations/auto-reply.service.ts',
  'conversations/conversations.module.ts',
  'conversations/conversations.service.ts',
  'faq/document/kb-document.service.ts',
  'faq/faq.module.ts',
  'faq/ingestion/faq-ingestion.processor.ts',
  'notifications/notifications.module.ts',
  'notifications/notifications.service.ts',
  'webhooks/webhooks.module.ts',
  'webhooks/webhooks.service.ts',
]);

const coreRel = (f: string) => rel(f).replace('core/', '');
const coreFilesImporting = (match: (importPath: string) => boolean) =>
  files(join(SRC, 'core'))
    .filter((f) => importsOf(f).some(match))
    .map(coreRel)
    .sort();

const IMPORTS_PRISMA_SERVICE = (i: string) =>
  i === '@/infrastructure/prisma/prisma.service.js';
const IMPORTS_INFRA_ADAPTERS = (i: string) =>
  ['queue', 'channels', 'events', 'transport'].some((d) =>
    i.startsWith(`@/infrastructure/${d}/`),
  );

describe('arquitectura: trinquete de deuda en core/', () => {
  it('core/ no importa las implementaciones Prisma de repositorios (solo interfaces)', () => {
    expect(
      coreFilesImporting((i) =>
        i.startsWith('@/infrastructure/prisma/repositories/'),
      ),
    ).toEqual([]);
  });

  it('core/ NO inyecta PrismaService: toda persistencia pasa por un repository (deuda saldada)', () => {
    expect(coreFilesImporting(IMPORTS_PRISMA_SERVICE)).toEqual([]);
  });

  it('modules/ tampoco usa PrismaService (ecosistemas y API común)', () => {
    const offenders = files(join(SRC, 'modules')).filter((f) =>
      importsOf(f).some(IMPORTS_PRISMA_SERVICE),
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it('core/ no suma imports de infrastructure/queue|channels|events|transport', () => {
    const now = coreFilesImporting(IMPORTS_INFRA_ADAPTERS);
    expect(now.filter((f) => !INFRA_DEBT.has(f))).toEqual([]);
  });

  it('INFRA_DEBT no tiene archivos ya corregidos (sacarlos de la lista)', () => {
    const now = new Set(coreFilesImporting(IMPORTS_INFRA_ADAPTERS));
    expect([...INFRA_DEBT].filter((f) => !now.has(f))).toEqual([]);
  });
});
