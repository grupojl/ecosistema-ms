#!/usr/bin/env node
// Postgres TEMPORAL para tests de integración (nunca apunta a una base real).
//   node pg-temp.js start [db]   → inicializa (si hace falta), arranca y crea la base; imprime la URL
//   node pg-temp.js url [db]     → imprime la URL
//   node pg-temp.js stop         → detiene el servidor
//   node pg-temp.js clean        → detiene y borra el directorio de datos
// Busca los binarios en PG_BIN, en "C:\Program Files\PostgreSQL\<versión>\bin" (la más nueva) o en el PATH.
// Variables: PG_TEMP_PORT (default 54329).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PORT = process.env.PG_TEMP_PORT || '54329';
const DATA = path.join(os.tmpdir(), `ecosistema-pg-${PORT}`, 'data');
const LOG = path.join(os.tmpdir(), `ecosistema-pg-${PORT}`, 'pg.log');
const exe = process.platform === 'win32' ? '.exe' : '';

function findBin() {
  const candidates = [];
  if (process.env.PG_BIN) candidates.push(process.env.PG_BIN);
  if (process.platform === 'win32') {
    const base = 'C:\\Program Files\\PostgreSQL';
    if (fs.existsSync(base)) {
      for (const v of fs.readdirSync(base).sort((a, b) => Number(b) - Number(a))) {
        candidates.push(path.join(base, v, 'bin'));
      }
    }
  }
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, `pg_ctl${exe}`))) return dir;
  }
  // PATH
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['pg_ctl'], { encoding: 'utf8' });
  if (probe.status === 0) return path.dirname(probe.stdout.split(/\r?\n/)[0].trim());
  return null;
}

const BIN = findBin();
if (!BIN) {
  console.error('No encontré los binarios de PostgreSQL. Definí PG_BIN o instalá PostgreSQL.');
  process.exit(2);
}
const bin = (name) => path.join(BIN, `${name}${exe}`);
const run = (name, args, opts = {}) =>
  spawnSync(bin(name), args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

const ready = () => run('pg_isready', ['-h', '127.0.0.1', '-p', PORT]).status === 0;
const url = (db) => `postgresql://postgres@127.0.0.1:${PORT}/${db}`;

const [cmd = 'start', db = 'chatia_it'] = process.argv.slice(2);

if (cmd === 'url') {
  console.log(url(db));
} else if (cmd === 'start') {
  if (!ready()) {
    fs.mkdirSync(path.dirname(DATA), { recursive: true });
    if (!fs.existsSync(path.join(DATA, 'PG_VERSION'))) {
      const r = run('initdb', ['-D', DATA, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8']);
      if (r.status !== 0) {
        console.error('initdb falló:\n' + r.stderr);
        process.exit(1);
      }
    }
    // stdio ignorado: si pg_ctl hereda los pipes del proceso padre, el comando queda colgado
    const s = spawnSync(bin('pg_ctl'), ['-D', DATA, '-o', `-p ${PORT}`, '-l', LOG, '-w', 'start'], {
      stdio: 'ignore',
    });
    if (s.status !== 0 || !ready()) {
      console.error(`pg_ctl start falló. Log: ${LOG}`);
      process.exit(1);
    }
  }
  const exists = run('psql', ['-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${db}'`]);
  if (!exists.stdout.includes('1')) {
    const c = run('createdb', ['-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', db]);
    if (c.status !== 0) {
      console.error('createdb falló:\n' + c.stderr);
      process.exit(1);
    }
  }
  console.log(url(db));
} else if (cmd === 'stop' || cmd === 'clean') {
  if (fs.existsSync(path.join(DATA, 'PG_VERSION'))) {
    spawnSync(bin('pg_ctl'), ['-D', DATA, 'stop', '-m', 'fast'], { stdio: 'ignore' });
  }
  if (cmd === 'clean') fs.rmSync(path.dirname(DATA), { recursive: true, force: true });
  console.log(cmd === 'clean' ? 'detenido y borrado' : 'detenido');
} else {
  console.error('Uso: node pg-temp.js start|url|stop|clean [db]');
  process.exit(2);
}
