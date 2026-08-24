// src/config/proto-paths.ts
// Resuelve rutas de .proto files compatible con dev y prod (Railway).
// En prod: el Dockerfile copia los protos a /app/proto/ (process.cwd()/proto)
// En dev:  los protos están en packages/proto/proto/ relativo al workspace root
import { join } from 'path';

// En Railway runner: WORKDIR=/app, protos copiados a /app/proto/
// En desarrollo local: los servicios corren desde su carpeta
const isProd = process.env['NODE_ENV'] === 'production';

const PROTO_DIR = isProd
  ? join(process.cwd(), 'proto')          // /app/proto/ en Railway
  : join(__dirname, '..', '..', '..', '..', 'packages', 'proto', 'proto'); // dev

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
