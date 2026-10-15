// Reestructura src/ de un servicio → solo core/, infrastructure/, modules/ (+ main.ts, app.module.ts, generated/).
// Mueve con git mv, reescribe los imports "@/..." y deja el servicio compilando. Ver ADR-022.
// Uso:  node .claude/tools/restructure-src.js <servicio-backend> [--dry]
// OJO: DIRS / CONTROLLER_DIRS son los de chatia-backend. Adaptarlos a las carpetas de cada servicio antes de correrlo,
// y después: ajustar module files (quitar `controllers:` de core/), scripts de package.json, jest/eslint y los tests que usan __dirname.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(process.argv[2]);
const dry = process.argv.includes('--dry');
const src = path.join(root, 'src');

// Carpeta completa → destino
const DIRS = {
  channels: 'infrastructure/channels',
  events: 'infrastructure/events',
  queue: 'infrastructure/queue',
  maintenance: 'infrastructure/maintenance',
  health: 'infrastructure/transport/health',
  internal: 'infrastructure/transport/internal',
  grpc: 'infrastructure/transport/grpc',
  privacy: 'core/privacy',
  test: 'infrastructure/testing',
  webhooks: 'core/webhooks',
  widget: 'core/widget',
  'channel-accounts': 'core/channel-accounts',
  'agent-notifications': 'core/agent-notifications',
};
// Archivos sueltos de la raíz
const ROOT_FILES = {
  'app.boot.spec.ts': 'infrastructure/testing/app.boot.spec.ts',
  'architecture.spec.ts': 'infrastructure/testing/architecture.spec.ts',
};
// Controllers de entrada: van a modules/common (los services quedan en core/)
const CONTROLLER_DIRS = ['webhooks', 'widget', 'channel-accounts', 'agent-notifications'];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(full);
    return [full];
  });
}
const rel = (f) => path.relative(src, f).split(path.sep).join('/');

function destinationOf(r) {
  if (ROOT_FILES[r]) return ROOT_FILES[r];
  const [top, ...rest] = r.split('/');
  if (!(top in DIRS)) return r;
  const file = rest.join('/');
  if (CONTROLLER_DIRS.includes(top) && /\.controller(\.spec)?\.ts$/.test(file)) {
    return `modules/common/${top}/${file}`;
  }
  return `${DIRS[top]}/${file}`;
}

const all = walk(src).filter((f) => !rel(f).startsWith('generated/'));
const moves = new Map(); // old rel → new rel
for (const f of all) {
  const r = rel(f);
  const d = destinationOf(r);
  if (d !== r) moves.set(r, d);
}

// Mapa de imports: '@/old/path.js' → '@/new/path.js'  (sin extensión .ts)
const importMap = new Map();
for (const [o, n] of moves) {
  if (!o.endsWith('.ts')) continue;
  importMap.set(`@/${o.replace(/\.ts$/, '.js')}`, `@/${n.replace(/\.ts$/, '.js')}`);
}

console.log(`${moves.size} archivos a mover, ${importMap.size} imports mapeados`);
if (dry) {
  for (const [o, n] of moves) console.log(`${o} -> ${n}`);
  process.exit(0);
}

// 1) mover con git (conserva historial)
for (const [o, n] of moves) {
  const from = path.join(src, o);
  const to = path.join(src, n);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  try {
    execFileSync('git', ['mv', from, to], { cwd: root, stdio: 'pipe' });
  } catch {
    fs.renameSync(from, to); // archivo sin seguimiento
  }
}

// 2) reescribir imports en TODOS los .ts de src (y test/ de la raíz del servicio si existe)
const targets = [...walk(src), ...(fs.existsSync(path.join(root, 'test')) ? walk(path.join(root, 'test')) : [])].filter(
  (f) => f.endsWith('.ts') && !f.includes(`${path.sep}generated${path.sep}`),
);
let changed = 0;
for (const f of targets) {
  const before = fs.readFileSync(f, 'utf8');
  const after = before.replace(/(['"`])(@\/[^'"`]+?\.js)\1/g, (m, q, spec) =>
    importMap.has(spec) ? `${q}${importMap.get(spec)}${q}` : m,
  );
  if (after !== before) {
    fs.writeFileSync(f, after);
    changed++;
  }
}
console.log(`imports reescritos en ${changed} archivos`);

// 3) quitar carpetas vacías que quedaron
for (const top of Object.keys(DIRS)) {
  const d = path.join(src, top);
  if (fs.existsSync(d) && walk(d).length === 0) fs.rmSync(d, { recursive: true, force: true });
}
