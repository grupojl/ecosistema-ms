#!/usr/bin/env node
// Compuerta de verificación de un servicio: typecheck → lint → tests (cobertura) → build [→ integración].
//   node .claude/skills/verify/scripts/verify.js <servicio-backend> [--integration] [--skip=lint,build] [--fast]
//   --fast  = solo typecheck + lint (sin tests ni build)
// Sale con código 1 si algún paso falla. Imprime un resumen y, ante un fallo, las últimas líneas del paso.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const service = args.find((a) => !a.startsWith('--'));
if (!service) {
  console.error('Uso: node verify.js <servicio-backend> [--integration] [--skip=paso,paso] [--fast]');
  process.exit(2);
}
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const dir = path.join(repo, service);
if (!fs.existsSync(path.join(dir, 'package.json'))) {
  console.error(`No existe ${dir}/package.json`);
  process.exit(2);
}
const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
const has = (script) => Boolean(pkg.scripts && pkg.scripts[script]);
const skip = new Set(((args.find((a) => a.startsWith('--skip=')) || '').slice(7) || '').split(',').filter(Boolean));
const fast = args.includes('--fast');
const integration = args.includes('--integration');

const results = [];
function step(name, script, env = {}) {
  if (skip.has(name) || (fast && ['test', 'build', 'integration'].includes(name))) {
    results.push({ name, status: 'SKIP' });
    return true;
  }
  if (!has(script)) {
    results.push({ name, status: 'N/A', note: `sin script "${script}"` });
    return true;
  }
  const t0 = Date.now();
  const r = spawnSync(`pnpm ${script}`, {
    cwd: dir,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const ok = r.status === 0;
  const extra = {};
  const tests = out.match(/Tests:\s+([^\n]+)/);
  if (tests) extra.tests = tests[1].trim();
  results.push({ name, status: ok ? 'PASS' : 'FAIL', secs, ...extra, tail: ok ? undefined : out.split('\n').slice(-30).join('\n') });
  return ok;
}

let ok = true;
ok = step('typecheck', 'typecheck') && ok;
ok = step('lint', 'lint:check') && ok;
ok = step('test', 'test:cov') && ok;
ok = step('build', 'build') && ok;

if (integration && !skip.has('integration') && !fast) {
  const pg = path.join(__dirname, 'pg-temp.js');
  const start = spawnSync('node', [pg, 'start', `${path.basename(dir).replace(/\W/g, '_')}_it`], { encoding: 'utf8' });
  if (start.status !== 0) {
    results.push({ name: 'integration', status: 'FAIL', tail: start.stderr || start.stdout });
    ok = false;
  } else {
    const url = start.stdout.trim();
    const mig = spawnSync('pnpm exec prisma migrate deploy', {
      cwd: dir,
      shell: true,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: url },
    });
    if (mig.status !== 0) {
      results.push({ name: 'integration', status: 'FAIL', tail: `migrate deploy falló:\n${(mig.stdout || '') + (mig.stderr || '')}`.split('\n').slice(-30).join('\n') });
      ok = false;
    } else {
      ok = step('integration', 'test:integration', { TEST_DATABASE_URL: url, DATABASE_URL: url }) && ok;
    }
    spawnSync('node', [pg, 'stop'], { stdio: 'ignore' });
  }
} else if (integration) {
  results.push({ name: 'integration', status: 'SKIP' });
}

console.log(`\nVerificación de ${service}`);
console.log('─'.repeat(60));
for (const r of results) {
  const detail = [r.secs && `${r.secs}s`, r.tests, r.note].filter(Boolean).join(' · ');
  console.log(`${r.status.padEnd(5)} ${r.name.padEnd(12)} ${detail}`);
}
for (const r of results.filter((x) => x.status === 'FAIL')) {
  console.log(`\n── ${r.name}: últimas líneas ──\n${r.tail}`);
}
console.log('─'.repeat(60));
console.log(ok ? 'RESULTADO: VERDE' : 'RESULTADO: ROJO');
process.exit(ok ? 0 : 1);
