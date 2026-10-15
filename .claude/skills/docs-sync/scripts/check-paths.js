#!/usr/bin/env node
// Detecta referencias a archivos/carpetas en los .md de .claude que YA NO EXISTEN en el repo.
//   node .claude/skills/docs-sync/scripts/check-paths.js [--service chatia-backend] [--json]
// Qué revisa (rutas entre `backticks`):
//   • `<algo>-backend/src/...`            → se resuelve contra ese servicio
//   • `src/...`                           → solo si el documento pertenece a un servicio
//                                           (.claude/services/<svc>.md o .claude/modules/<svc>/*.md)
//   • `packages/...`, `.claude/...`, `.github/...` → contra la raíz del repo
// Ignora rutas con placeholders ({x}, <x>), comodines (*), y bloques de código de ejemplo "incorrectos" (líneas con ❌).
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const only = args.includes('--service') ? args[args.indexOf('--service') + 1] : null;
const asJson = args.includes('--json');

const repo = path.resolve(__dirname, '..', '..', '..', '..');
const claude = path.join(repo, '.claude');

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return ['node_modules', 'tools', 'decisions'].includes(e.name) ? [] : walk(p);
    return p.endsWith('.md') && !/\.bak/.test(p) ? [p] : [];
  });

const exists = (p) => fs.existsSync(p);

/** Servicio al que "pertenece" un documento (para resolver `src/...`). */
function serviceOfDoc(file) {
  const rel = path.relative(claude, file).split(path.sep).join('/');
  let m = rel.match(/^services\/([a-z]+-backend)\.md$/);
  if (m) return m[1];
  m = rel.match(/^modules\/([a-z]+-backend)\//);
  return m ? m[1] : null;
}

const findings = [];
for (const file of walk(claude)) {
  const docService = serviceOfDoc(file);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/❌|incorrecto|antes:|era:|ahora ya no|legacy|deprecated/i.test(line)) return; // ejemplos de lo que NO hacer / historia
    for (const m of line.matchAll(/`([^`\s]+)`/g)) {
      let token = m[1].replace(/[.,;:]+$/, '');
      if (/[{}<>*$|]/.test(token) || token.includes('...')) continue;
      if (!/\//.test(token)) continue;
      if (/^https?:/.test(token)) continue;

      let service = null;
      let target = null;
      const svcMatch = token.match(/^([a-z]+-backend)\/(.+)$/);
      if (svcMatch) {
        service = svcMatch[1];
        target = path.join(repo, token);
      } else if (/^src\//.test(token) && docService) {
        service = docService;
        target = path.join(repo, docService, token);
      } else if (/^(packages|\.claude|\.github)\//.test(token)) {
        target = path.join(repo, token);
      } else {
        continue;
      }
      if (only && service !== only) continue;
      // `a/b.ts:123` o `a/b.ts#L1` → quitar sufijos
      target = target.replace(/[:#]\d.*$/, '');
      if (!exists(target) && !exists(target.replace(/\/$/, ''))) {
        findings.push({
          doc: path.relative(repo, file).split(path.sep).join('/'),
          line: i + 1,
          ref: token,
        });
      }
    }
  });
}

if (asJson) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(findings.length ? 1 : 0);
}
if (findings.length === 0) {
  console.log('docs-sync: todas las rutas citadas existen.');
  process.exit(0);
}
const byDoc = new Map();
for (const f of findings) byDoc.set(f.doc, [...(byDoc.get(f.doc) || []), f]);
console.log(`docs-sync: ${findings.length} referencia(s) a rutas inexistentes en ${byDoc.size} documento(s)\n`);
for (const [doc, list] of byDoc) {
  console.log(doc);
  for (const f of list) console.log(`  L${f.line}  ${f.ref}`);
}
process.exit(1);
