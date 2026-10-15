#!/usr/bin/env node
// Escáner de seguridad multi-tenant de un servicio. HEURÍSTICO: marca lo que hay que mirar, no prueba nada.
//   node .claude/skills/security-review-tenant/scripts/scan.js <servicio-backend> [--json]
// Revisa: endpoints sin guard, Prisma sin filtro de tenant, @Body sin validación Zod, webhooks sin firma,
// escrituras con identidad tomada del body, y rutas con datos de rol/permiso modificables.
const fs = require('fs');
const path = require('path');

const service = process.argv[2];
const asJson = process.argv.includes('--json');
if (!service || service.startsWith('--')) {
  console.error('Uso: node scan.js <servicio-backend> [--json]');
  process.exit(2);
}
const repo = path.resolve(__dirname, '..', '..', '..', '..');
const src = path.join(repo, service, 'src');
if (!fs.existsSync(src)) {
  console.error(`No existe ${src}`);
  process.exit(2);
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return ['node_modules', 'generated', 'dist'].includes(e.name) ? [] : walk(p);
    return [p];
  });
const rel = (f) => path.relative(src, f).split(path.sep).join('/');
const read = (f) => fs.readFileSync(f, 'utf8');
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

const prod = walk(src).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !rel(f).includes('/testing/') && !rel(f).startsWith('test/'));
const findings = [];
const add = (severity, rule, file, line, detail) => findings.push({ severity, rule, file: rel(file), line, detail });

// Endpoints que son públicos POR DISEÑO (se documenta el motivo; cualquier otro hay que justificarlo)
const PUBLIC_BY_DESIGN = [
  { re: /health\.controller/, why: 'healthcheck de Railway' },
  { re: /widget\.controller/, why: 'widget público: sesión firmada + límites propios' },
  { re: /webhooks\.controller/, why: 'entrada de plataformas externas: debe verificar FIRMA' },
];

const SIGNATURE_EVIDENCE = prod.some((f) => /verifySignature|verifyWebhookSignature|timingSafeEqual/.test(read(f)));
const controllers = prod.filter((f) => /\.controller\.ts$/.test(f));

for (const f of controllers) {
  const text = read(f);
  const publicWhy = PUBLIC_BY_DESIGN.find((p) => p.re.test(f));

  // 1) Guard a nivel de clase o de método
  // decoradores de clase = todo lo anterior a `export class` (un @UseGuards( ahí es a nivel de clase)
  const head = text.slice(0, text.indexOf('export class'));
  // Autenticación propia por clave de plataforma/interna (ej. ecosystem y internal): se reporta como INFO
  const keyGuarded = /PLATFORM_ADMIN_KEY|x-platform-admin-key|x-internal-api-key|InternalApiKeyGuard/.test(text);
  const classGuard = head.includes('@UseGuards(');
  const routes = [...text.matchAll(/@(Get|Post|Put|Patch|Delete)\(([^)]*)\)([\s\S]*?)(?=\n\s*(?:async\s+)?[a-zA-Z_]+\s*\()/g)];
  if (keyGuarded && !classGuard) {
    add('INFO', 'auth-por-clave', f, 1, 'autenticación por clave (PLATFORM_ADMIN_KEY / x-internal-api-key): revisar que TODOS los métodos la validen');
  } else if (!classGuard) {
    for (const m of routes) {
      const block = m[0];
      if (!/@UseGuards\(/.test(block) && !publicWhy) {
        add('ALTA', 'endpoint-sin-guard', f, lineOf(text, m.index), `${m[1].toUpperCase()} ${m[2] || '/'} sin @UseGuards (ni a nivel de clase)`);
      }
    }
  }
  if (publicWhy && !classGuard) {
    add('INFO', 'publico-por-diseño', f, 1, publicWhy.why);
  }

  // 2) @Body sin ZodValidationPipe
  for (const m of text.matchAll(/@Body\(([^)]*)\)/g)) {
    // el body de un webhook es el payload crudo de la plataforma: se autentica por FIRMA, no por Zod
    if (!/ZodValidationPipe|Pipe/.test(m[1]) && !/webhooks?\.controller/.test(f)) {
      add('MEDIA', 'body-sin-validacion', f, lineOf(text, m.index), '@Body() sin pipe de validación Zod');
    }
  }

  // 3) Identidad tomada del body
  // (los controllers con auth por clave de plataforma/interna reciben el tenant objetivo en el body por diseño)
  if (!keyGuarded) {
    for (const m of text.matchAll(/dto\.(organizationId|firebaseUid|ecosystemId|role)\b/g)) {
      add('ALTA', 'identidad-del-body', f, lineOf(text, m.index), `usa dto.${m[1]}: la identidad debe salir del token (TenantContext), no del body`);
    }
  }

  // 4) Webhooks: la verificación de firma puede estar en el controller o en un service (se busca en todo el servicio)
  if (/webhooks?\.controller/.test(f) && !SIGNATURE_EVIDENCE) {
    add('ALTA', 'webhook-sin-firma', f, 1, 'No encontré verificación de firma HMAC de webhooks en el servicio');
  }
}

// 5) Prisma sin filtro de tenant (heurística sobre el código de aplicación)
// Una consulta cuenta como acotada si filtra por el tenant O por una clave que ya cuelga de un tenant
// (conversationId, channelAccountId, projectId, agentId…: el ownership se verificó antes). Se marcan solo las
// operaciones de LISTADO/BORRADO MASIVO sin ningún acotamiento, y se resume el resto de mutaciones por id.
const TENANT = /organizationId|ecosystemId|organization:|channelAccount:|tenant/;
const SCOPED_BY_PARENT = /conversationId|channelAccountId|channelAccount|projectId|agentId|assistantConfigId|knowledgeBaseId|documentId|contactId|externalUserId|sessionId|accountIds|\bin:/;
const MODELS_GLOBAL = /^(ecosystem|organization)$/; // tablas globales / raíz de tenant
const MASS_OPS = /findMany|findFirst|count|deleteMany|updateMany/;
// jobs de mantenimiento globales por diseño (retención de datos, CLI): se dejan en INFO
const GLOBAL_BY_DESIGN = /privacy\/retention|maintenance\//;
// limpieza por antigüedad (cutoff): retención de datos, global por diseño (en prisma-privacy.repository)
const RETENTION = /\bcutoff\b/;
// Si el body usa un identificador (where: x, ...x, { where }), busca su 'const x = {' hacia atrás y comprueba que filtre por tenant o por una clave que cuelga de uno
function resolvedScope(text, idx, body) {
  const ids = new Set([...body.matchAll(/(?:where:\s*|\.\.\.|\{\s*)([a-zA-Z_]\w*)\b/g)].map((x) => x[1]));
  if (/(^|[\s,{])where\s*(,|$)/.test(body)) ids.add('where');
  for (const id of ids) {
    const decl = text.slice(Math.max(0, idx - 2500), idx).lastIndexOf('const ' + id);
    if (decl < 0) continue;
    const block = text.slice(Math.max(0, idx - 2500) + decl, idx);
    if (TENANT.test(block) || SCOPED_BY_PARENT.test(block)) return true;
  }
  return false;
}
const byIdOnly = new Map();
for (const f of prod) {
  if (!/\.(service|repository)\.ts$|\.store\.ts$|\.processor\.ts$|\.controller\.ts$/.test(f)) continue;
  const text = read(f);
  for (const m of text.matchAll(/prisma\.([a-zA-Z]+)\.(findMany|findFirst|findUnique|update|updateMany|delete|deleteMany|count|upsert)\(\s*\{([\s\S]{0,260}?)\}\s*\)/g)) {
    const [, model, op, body] = m;
    if (MODELS_GLOBAL.test(model) || TENANT.test(body)) continue;
    if (GLOBAL_BY_DESIGN.test(rel(f)) || RETENTION.test(body)) continue;
    // el filtro se armó en una variable (where / scope): se evalúa su declaración previa en la misma función
    if (resolvedScope(text, m.index, body)) continue;
    if (MASS_OPS.test(op) && !SCOPED_BY_PARENT.test(body)) {
      add('MEDIA', 'listado-sin-tenant', f, lineOf(text, m.index), `prisma.${model}.${op}(...) sin organizationId ni clave acotada por un tenant`);
    } else if (!MASS_OPS.test(op)) {
      byIdOnly.set(rel(f), (byIdOnly.get(rel(f)) || 0) + 1);
    }
  }
}
for (const [file, n] of byIdOnly) {
  findings.push({ severity: 'INFO', rule: 'mutacion-por-id', file, line: 0, detail: `${n} lectura/mutación(es) por id sin tenant en el where: verificar que el ownership se compruebe ANTES (findFirst con organizationId)` });
}

// 6) Configuración riesgosa
for (const f of prod) {
  const text = read(f);
  for (const m of text.matchAll(/rejectUnauthorized:\s*false|origin:\s*['"]\*['"]|cors\(\s*\)/g)) {
    add('MEDIA', 'config-riesgosa', f, lineOf(text, m.index), `aparece "${m[0]}": confirmar que está bloqueado en producción`);
  }
}

const order = { ALTA: 0, MEDIA: 1, INFO: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity] || a.file.localeCompare(b.file));

if (asJson) {
  console.log(JSON.stringify({ service, findings }, null, 2));
  process.exit(0);
}
const bySev = (s) => findings.filter((x) => x.severity === s);
console.log(`\nSeguridad multi-tenant de ${service} (heurística — verificar cada hallazgo a mano)\n${'─'.repeat(70)}`);
for (const s of ['ALTA', 'MEDIA', 'INFO']) {
  const list = bySev(s);
  console.log(`\n${s} (${list.length})`);
  for (const x of list) console.log(`  ${x.file}:${x.line}  [${x.rule}] ${x.detail}`);
}
console.log(`\n${'─'.repeat(70)}\nTotal: ${bySev('ALTA').length} alta · ${bySev('MEDIA').length} media · ${bySev('INFO').length} info`);
process.exit(bySev('ALTA').length > 0 ? 1 : 0);
