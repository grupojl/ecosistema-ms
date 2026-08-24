// packages/proto/src/index.ts
// Sin import.meta ni __dirname — incompatibles entre ESM y CJS.
// Los servicios resuelven el path absoluto con path.join(protoDir, PROTO_FILE).
// Ver: cada servicio tiene PROTO_DIR configurado en su app.module o grpc.module.

// Nombres de los archivos .proto
export const CHATIA_PROTO_FILE    = 'chatia.proto';
export const NOTIF_PROTO_FILE     = 'notificaciones.proto';
export const ANALYTICS_PROTO_FILE = 'analytics.proto';
export const WORKERS_PROTO_FILE   = 'workers.proto';
export const PAGOS_PROTO_FILE     = 'pagos.proto';

// Nombres de packages gRPC (campo `package` en cada .proto)
export const CHATIA_PACKAGE    = 'chatia';
export const NOTIF_PACKAGE     = 'notificaciones';
export const ANALYTICS_PACKAGE = 'analytics';
export const WORKERS_PACKAGE   = 'workers';
export const PAGOS_PACKAGE     = 'pagos';
