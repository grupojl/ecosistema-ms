import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROTO_DIR  = path.join(__dirname, "..", "proto");

export const CHATIA_PROTO_PATH    = path.join(PROTO_DIR, "chatia.proto");
export const CHATIA_PACKAGE       = "chatia";
export const CHATIA_SERVICE       = "ChatIaService";

export const PAGOS_PROTO_PATH     = path.join(PROTO_DIR, "pagos.proto");
export const PAGOS_PACKAGE        = "pagos";
export const PAGOS_SERVICE        = "PagosService";

// ADR-003
export const NOTIF_PROTO_PATH     = path.join(PROTO_DIR, "notificaciones.proto");
export const NOTIF_PACKAGE        = "notificaciones";
export const NOTIF_SERVICE        = "NotificacionesService";

export const ANALYTICS_PROTO_PATH = path.join(PROTO_DIR, "analytics.proto");
export const ANALYTICS_PACKAGE    = "analytics";
export const ANALYTICS_SERVICE    = "AnalyticsService";

export const WORKERS_PROTO_PATH   = path.join(PROTO_DIR, "workers.proto");
export const WORKERS_PACKAGE      = "workers";
export const WORKERS_SERVICE      = "WorkersService";
