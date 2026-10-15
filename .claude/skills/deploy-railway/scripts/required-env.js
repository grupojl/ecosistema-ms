#!/usr/bin/env node
// Matriz de variables de entorno de un servicio, sacada del CÓDIGO (no de la memoria).
//   node .claude/skills/deploy-railway/scripts/required-env.js <servicio-backend> [--json]
// Muestra: variables que el servicio lee, cuáles EXIGE el esquema de validación en producción (fail('X', …))
// y cuáles faltan en .env.example. Es el punto de partida para cargar Railway sin sorpresas de arranque.
const fs = require('fs');
const path = require('path');

const service = process.argv[2];
const asJson = process.argv.includes('--json');
if (!service || service.startsWith('--')) {
  console.error('Uso: node required-env.js <servicio-backend> [--json]');
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
    if (e.isDirectory()) return ['node_modules', 'generated', 'dist'].includes(e.name) ? [] : walk(p);
    return p.endsWith('.ts') && !p.endsWith('.spec.ts') ? [p] : [];
  });
const relSrc = (f) => path.relative(src, f).split(path.sep).join('/');
const files = walk(src).filter((f) => !/(^|\/)(testing|test)\//.test(relSrc(f)));
const text = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

// Variables leídas
const used = new Set();
for (const m of text.matchAll(/process\.env\[\s*['"]([A-Z0-9_]+)['"]\s*\]|process\.env\.([A-Z0-9_]+)/g)) used.add(m[1] || m[2]);
for (const m of text.matchAll(/(?:config|configService)\.get(?:OrThrow)?(?:<[^>]*>)?\(\s*['"]([A-Z0-9_]+)['"]/g)) used.add(m[1]);

// Variables que el esquema exige en producción: todo `env.NOMBRE` referenciado dentro del bloque que corre solo con
// NODE_ENV=production, y los fail('NOMBRE', …). Las que se comparan `=== 'true'` para FALLAR están PROHIBIDAS.
const required = new Set();
const prohibited = new Set();
const prodSchema = files.find((f) => /validation\.schema\.ts$|env\.validation\.ts$/.test(f));
if (prodSchema) {
  const body = fs.readFileSync(prodSchema, 'utf8');
  const idx = body.search(/NODE_ENV\s*!==\s*['"]production['"]/);
  const block = idx > -1 ? body.slice(idx) : '';
  for (const m of block.matchAll(/if\s*\(\s*env\.([A-Z0-9_]+)\s*===\s*['"]true['"]\s*\)/g)) prohibited.add(m[1]);
  for (const m of block.matchAll(/env\.([A-Z0-9_]+)/g)) if (!prohibited.has(m[1])) required.add(m[1]);
  for (const m of block.matchAll(/fail\(\s*['"]([A-Z0-9_]+)['"]/g)) if (!prohibited.has(m[1])) required.add(m[1]);
}
// Esquemas zod sin .optional() dentro de validation.schema
const schemaFile = files.find((f) => /validation\.schema\.ts$|env\.validation\.ts$/.test(f));
const zodRequired = new Set();
if (schemaFile) {
  for (const m of fs.readFileSync(schemaFile, 'utf8').matchAll(/^\s+([A-Z][A-Z0-9_]+):\s*z\.[^\n]*$/gm)) {
    if (!/optional|default/.test(m[0])) zodRequired.add(m[1]);
  }
}

// .env.example
const exampleFile = path.join(root, '.env.example');
const example = new Set();
if (fs.existsSync(exampleFile)) {
  for (const m of fs.readFileSync(exampleFile, 'utf8').matchAll(/^\s*#?\s*([A-Z][A-Z0-9_]+)\s*=/gm)) example.add(m[1]);
}

const ignore = new Set(['NODE_ENV', 'PORT', 'npm_package_version', 'CI']);
for (const n of required) used.add(n);
const all = [...used].filter((n) => !ignore.has(n) && !prohibited.has(n)).sort();
const rows = all.map((name) => ({
  name,
  requiredInProd: required.has(name) || zodRequired.has(name),
  inEnvExample: example.has(name),
}));
const missingInExample = rows.filter((r) => !r.inEnvExample).map((r) => r.name);

if (asJson) {
  console.log(JSON.stringify({ service, rows, missingInExample }, null, 2));
  process.exit(0);
}
const req = rows.filter((r) => r.requiredInProd);
const opt = rows.filter((r) => !r.requiredInProd);
console.log(`\nVariables de ${service}  (NODE_ENV=production + REDIS_ENABLED=true + DATABASE_URL siempre)\n${'─'.repeat(66)}`);
console.log(`OBLIGATORIAS en producción (el arranque falla si faltan): ${req.length}`);
for (const r of req) console.log(`  [x] ${r.name}${r.inEnvExample ? '' : '   ← falta en .env.example'}`);
console.log(`\nOPCIONALES / con valor por defecto: ${opt.length}`);
for (const r of opt) console.log(`  [ ] ${r.name}${r.inEnvExample ? '' : '   ← falta en .env.example'}`);
console.log(`\nLeídas por el código pero ausentes en .env.example: ${missingInExample.length}${missingInExample.length ? '\n  ' + missingInExample.join(', ') : ''}`);
console.log('─'.repeat(66));
console.log('Nota: INTERNAL_API_KEY y CHAT_INTERNAL_API_KEY son alternativas (alcanza con una, mínimo 16 caracteres).');
console.log('Nota: las claves de proveedores (Groq, SiliconFlow, ElevenLabs…) suelen ser opcionales para ARRANCAR,');
console.log('pero sin ellas la IA no responde: marcarlas como necesarias para la prueba real.');
