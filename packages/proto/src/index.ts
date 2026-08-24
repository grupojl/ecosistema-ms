// packages/proto/src/index.ts
// Usa process.cwd() — funciona en CJS, ESM, dev y prod sin cambios.
// En Railway runner (WORKDIR=/app): protos en /app/proto/
// En desarrollo (cwd = raíz monorepo): protos en packages/proto/proto/
import { join } from 'path';

const cwd = process.cwd();

// Detectar si los protos están en ./proto (runner) o en packages/proto/proto (dev)
// El Dockerfile copia los protos a {WORKDIR}/proto/
const PROTO_DIR = join(cwd, 'proto');

export const CHATIA_PROTO_PATH    = join(PROTO_DIR, 'chatia.proto');
export const NOTIF_PROTO_PATH     = join(PROTO_DIR, 'notificaciones.proto');
export const ANALYTICS_PROTO_PATH = join(PROTO_DIR, 'analytics.proto');
export const WORKERS_PROTO_PATH   = join(PROTO_DIR, 'workers.proto');
export const PAGOS_PROTO_PATH     = join(PROTO_DIR, 'pagos.proto');

export const CHATIA_PACKAGE    = 'chatia';
export const NOTIF_PACKAGE     = 'notificaciones';
export const ANALYTICS_PACKAGE = 'analytics';
export const WORKERS_PACKAGE   = 'workers';
export const PAGOS_PACKAGE     = 'pagos';
