// packages/proto/src/index.ts
// Los .proto viajan DENTRO del package (packages/proto/proto), así que se resuelven
// relativo a este archivo (dist/index.js → ../proto). No dependen del cwd ni del Dockerfile.
import { join } from 'path';

const PROTO_DIR = join(__dirname, '..', 'proto');

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
