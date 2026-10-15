#!/usr/bin/env node
// Métricas MEDIBLES de un servicio, para puntuarlo sin opinión. Solo lee (no ejecuta tests ni build).
//   node .claude/skills/audit-service/scripts/metrics.js <servicio-backend> [--json]
// La cobertura sale de <servicio>/coverage/coverage-summary.json si existe (generarla con el skill verify).
const fs = require('fs');
const path = require('path');

const service = process.argv[2];
const asJson = process.argv.includes('--json');
if (!service || service.startsWith('--')) {
  console.error('Uso: node metrics.js <servicio-backend> [--json]');
  process.exit(2);
}
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const root = path.join(repo, service);
const src = path.join(root, 'src');
if (!fs.existsSync(src)) {
  console.error(`No existe ${src}`);
  process.exit(2);
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return ['node_modules', 'generated', 'dist', 'coverage'].includes(e.name) ? [] : walk(p);
    return [p];
  });
const rel = (f) => path.relative(src, f).split(path.sep).join('/');
const read = (f) => fs.readFileSync(f, 'utf8');

const all = walk(src);
const ts = all.filter((f) => f.endsWith('.ts'));
const prod = ts.filter((f) => !f.endsWith('.spec.ts') && !rel(f).startsWith('test/') && !rel(f).includes('/testing/'));
const specs = ts.filter((f) => f.endsWith('.spec.ts'));

const grep = (files, re) => files.filter((f) => re.test(read(f))).map(rel);
const count = (files, re) => files.reduce((n, f) => n + (read(f).match(re) || []).length, 0);

// ── Estructura ──────────────────────────────────────────────────────────────────────────────
const topEntries = fs.readdirSync(src);
const ALLOWED_TOP = new Set(['core', 'infrastructure', 'modules', 'generated', 'main.ts', 'app.module.ts']);
const extraTop = topEntries.filter((n) => !ALLOWED_TOP.has(n));
const controllersInCore = grep(prod.filter((f) => rel(f).startsWith('core/')), /@Controller\(/);

// ── Reglas duras ────────────────────────────────────────────────────────────────────────────
const relativeImports = grep(prod, /from\s+['"]\.\.?\//);
const prismaClientImports = grep(prod, /from\s+['"]@prisma\/client['"]/);
const anyUsage = grep(prod, /:\s*any\b|as any\b|<any>|any\[\]/);
const eslintDisable = grep(prod, /eslint-disable/);
const prismaInCore = grep(prod.filter((f) => rel(f).startsWith('core/')), /prisma\.service\.js/);
// health/grpc/internal son adaptadores de transporte: usar Prisma ahí es legítimo (SELECT 1, superadmin)
const isTransport = (f) => /(^|\/)(transport|health|internal|grpc)\//.test(rel(f));
const prismaInControllers = grep(prod.filter((f) => /\.controller\.ts$/.test(f) && !isTransport(f)), /PrismaService/);

// ── Higiene ─────────────────────────────────────────────────────────────────────────────────
const stray = walk(root)
  .filter((f) => !f.includes('node_modules'))
  .map((f) => path.relative(root, f).split(path.sep).join('/'))
  .filter((f) => /\.bak(\.|$)/.test(f) || /^x(\.sh)?$/.test(f) || /\.orig$/.test(f));
const todos = count(prod, /\b(TODO|FIXME)\b/g);

// ── Tests ───────────────────────────────────────────────────────────────────────────────────
const services = prod.filter((f) => /\.service\.ts$/.test(f));
const servicesWithoutSpec = services.filter((f) => !fs.existsSync(f.replace(/\.ts$/, '.spec.ts'))).map(rel);
const integrationSpecs = specs.filter((f) => /integration/.test(f)).length;

let coverage = null;
const covFile = path.join(root, 'coverage', 'coverage-summary.json');
if (fs.existsSync(covFile)) {
  const t = JSON.parse(read(covFile)).total;
  coverage = {
    statements: t.statements.pct,
    branches: t.branches.pct,
    functions: t.functions.pct,
    lines: t.lines.pct,
    measuredAt: fs.statSync(covFile).mtime.toISOString().slice(0, 10),
  };
}

// ── Seguridad / multi-tenancy (heurísticas: revisar a mano con security-review-tenant) ──────
const controllers = prod.filter((f) => /\.controller\.ts$/.test(f));
const controllersWithoutGuard = controllers
  .filter((f) => !/UseGuards|Guard\b|@Public|@MessagePattern|@GrpcMethod/.test(read(f)))
  .map(rel);

// ── Operación ───────────────────────────────────────────────────────────────────────────────
const exists = (p) => fs.existsSync(path.join(root, p));
const ops = {
  dockerfile: exists('Dockerfile'),
  railwayJson: exists('railway.json'),
  healthController: controllers.some((f) => /health/.test(rel(f))),
  envValidation: ts.some((f) => /validation\.schema|env\.validation|config\/env/.test(rel(f))),
  ciWorkflow: fs.existsSync(path.join(repo, '.github', 'workflows', `ci-${service}.yml`)),
};

const metrics = {
  service,
  structure: { extraTopLevel: extraTop, controllersInCore },
  hardRules: {
    relativeImports,
    prismaClientImports,
    anyUsage,
    eslintDisable,
    prismaInCoreFiles: prismaInCore.length,
    prismaInControllers,
  },
  hygiene: { strayFiles: stray, todos },
  tests: {
    specFiles: specs.length,
    integrationSpecs,
    servicesWithoutSpec,
    coverage,
  },
  security: { controllersWithoutGuard },
  operations: ops,
};

if (asJson) {
  console.log(JSON.stringify(metrics, null, 2));
  process.exit(0);
}

const flag = (n) => (n === 0 ? 'OK ' : 'XX ');
const list = (a, max = 6) => (a.length ? `\n      ${a.slice(0, max).join('\n      ')}${a.length > max ? `\n      … y ${a.length - max} más` : ''}` : '');
console.log(`\nMétricas de ${service}\n${'─'.repeat(64)}`);
console.log(`ESTRUCTURA (ADR-022)`);
console.log(`  ${flag(extraTop.length)}carpetas extra en src/: ${extraTop.length}${list(extraTop)}`);
console.log(`  ${flag(controllersInCore.length)}@Controller dentro de core/: ${controllersInCore.length}${list(controllersInCore)}`);
console.log(`REGLAS DURAS`);
console.log(`  ${flag(relativeImports.length)}imports relativos: ${relativeImports.length}${list(relativeImports)}`);
console.log(`  ${flag(prismaClientImports.length)}imports de @prisma/client: ${prismaClientImports.length}${list(prismaClientImports)}`);
console.log(`  ${flag(anyUsage.length)}uso de any: ${anyUsage.length}${list(anyUsage)}`);
console.log(`  ${flag(eslintDisable.length)}eslint-disable: ${eslintDisable.length}${list(eslintDisable)}`);
console.log(`  ${flag(prismaInControllers.length)}controllers con PrismaService: ${prismaInControllers.length}${list(prismaInControllers)}`);
console.log(`  ${prismaInCore.length === 0 ? 'OK ' : '.. '}archivos de core/ con PrismaService directo: ${prismaInCore.length}`);
console.log(`HIGIENE`);
console.log(`  ${flag(stray.length)}archivos sueltos (.bak, x, x.sh): ${stray.length}${list(stray)}`);
console.log(`  ..  TODO/FIXME en código: ${todos}`);
console.log(`TESTS`);
console.log(`  ..  specs: ${specs.length} (integración: ${integrationSpecs})`);
console.log(`  ${flag(servicesWithoutSpec.length)}services sin spec: ${servicesWithoutSpec.length}${list(servicesWithoutSpec)}`);
console.log(
  coverage
    ? `  ..  cobertura (${coverage.measuredAt}): ${coverage.statements}% stmts · ${coverage.branches}% branches · ${coverage.functions}% funcs · ${coverage.lines}% lines`
    : `  ??  cobertura: sin medir (correr el skill verify)`,
);
console.log(`SEGURIDAD (heurística)`);
console.log(`  ${flag(controllersWithoutGuard.length)}controllers sin guard visible: ${controllersWithoutGuard.length}${list(controllersWithoutGuard)}`);
console.log(`OPERACIÓN`);
for (const [k, v] of Object.entries(ops)) console.log(`  ${v ? 'OK ' : 'XX '}${k}`);
console.log('─'.repeat(64));
