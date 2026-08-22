#!/usr/bin/env bash
# =============================================================================
# x.sh — Genera .env.example para todos los servicios del ecosistema-ms
# Ejecutar: bash x.sh   ó   make x
# Sin Python. Entorno: Windows + Git Bash | Node 24 | pnpm 10
#
# Railway lee el .env.example de cada servicio para pre-cargar variables.
# Completar los valores en Railway con los reales después de deployar.
# =============================================================================
set -euo pipefail

ROOT="$(pwd)"
GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${CYAN}[env]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

[ -f "$ROOT/pnpm-workspace.yaml" ] || { echo "Correr desde la raíz de ecosistema-ms/"; exit 1; }

log "Generando .env.example para todos los servicios..."
log ""

# =============================================================================
# chatia-backend — puerto 3000 / gRPC 5001
# =============================================================================
cat > "$ROOT/chatia-backend/.env.example" << 'EOF'
# =============================================================================
# chatia-backend — .env.example
# Railway: Root Directory=/  |  Dockerfile Path=chatia-backend/Dockerfile
# Puerto HTTP: 3000  |  Puerto gRPC: 5001
# =============================================================================

# ── PostgreSQL ────────────────────────────────────────────────────────────────
# Railway: conectar el plugin PostgreSQL y usar la variable DATABASE_URL que genera
DATABASE_URL=postgresql://user:password@postgres.railway.internal:5432/chatia_db

# ── Redis (compartido con todos los servicios) ────────────────────────────────
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=
# JSON del service account de Firebase en UNA SOLA LÍNEA
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account","project_id":"","private_key_id":"","private_key":"","client_email":"","client_id":"","auth_uri":"","token_uri":""}

# ── IA — Groq ─────────────────────────────────────────────────────────────────
GROQ_API_KEY=

# ── Meta / WhatsApp ───────────────────────────────────────────────────────────
# Webhooks entrantes de Meta apuntan a: https://chatia-backend.railway.app/api/v1/webhooks/whatsapp
META_SYSTEM_TOKEN=
META_APP_SECRET=
META_PHONE_NUMBER_ID=

# ── ADR-003: URLs de microservicios nuevos ────────────────────────────────────
# URL pública (para redireccionamiento 410 Gone en endpoints deprecados)
ANALYTICS_BACKEND_URL=https://analytics-backend.railway.app
# URLs internas Railway (red privada — no cambiar el formato)
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003
WORKERS_GRPC_URL=workers-backend.railway.internal:5005

# ── Runtime ───────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
GRPC_PORT=5001
EOF
ok "chatia-backend/.env.example"

# =============================================================================
# pasarelapagos-backend — puerto 3001 / gRPC 5002
# =============================================================================
cat > "$ROOT/pasarelapagos-backend/.env.example" << 'EOF'
# =============================================================================
# pasarelapagos-backend — .env.example
# Railway: Root Directory=/  |  Dockerfile Path=pasarelapagos-backend/Dockerfile
# Puerto HTTP: 3001  |  Puerto gRPC: 5002
# =============================================================================

# ── PostgreSQL ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@postgres.railway.internal:5432/pasarelapagos_db

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account","project_id":"","private_key_id":"","private_key":"","client_email":"","client_id":"","auth_uri":"","token_uri":""}

# ── Proveedores de pago ───────────────────────────────────────────────────────
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# dLocal (si aplica)
DLOCAL_API_KEY=
DLOCAL_SECRET_KEY=

# Conekta (si aplica)
CONEKTA_API_KEY=

# Pagarme (si aplica)
PAGARME_API_KEY=

# ── Webhook URL base (Railway pública) ────────────────────────────────────────
# Stripe:      https://pasarelapagos-backend.railway.app/api/v1/webhooks/stripe
# MercadoPago: https://pasarelapagos-backend.railway.app/api/v1/webhooks/mercadopago
WEBHOOK_BASE_URL=https://pasarelapagos-backend.railway.app

# ── gRPC outbound ─────────────────────────────────────────────────────────────
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001

# ── Runtime ───────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3001
GRPC_PORT=5002
EOF
ok "pasarelapagos-backend/.env.example"

# =============================================================================
# notificaciones-backend — puerto 3002 / gRPC 5003
# =============================================================================
cat > "$ROOT/notificaciones-backend/.env.example" << 'EOF'
# =============================================================================
# notificaciones-backend — .env.example
# Railway: Root Directory=/  |  Dockerfile Path=notificaciones-backend/Dockerfile
# Puerto HTTP: 3002  |  Puerto gRPC: 5003
# =============================================================================

# ── PostgreSQL ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@postgres.railway.internal:5432/notificaciones_db

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account","project_id":"","private_key_id":"","private_key":"","client_email":"","client_id":"","auth_uri":"","token_uri":""}

# ── WhatsApp (Meta Cloud API) ─────────────────────────────────────────────────
# Mismo token que chatia-backend — son el mismo número de WhatsApp Business
META_SYSTEM_TOKEN=
META_PHONE_NUMBER_ID=

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=
RESEND_FROM_ADDRESS=noreply@tudominio.com

# ── Push (Firebase Cloud Messaging) ──────────────────────────────────────────
# Mismo proyecto Firebase que el auth — usar el mismo service account
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
# IMPORTANTE: reemplazar los saltos de línea reales por \n literal en Railway
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n

# ── gRPC outbound ─────────────────────────────────────────────────────────────
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001

# ── DLQ alertas ───────────────────────────────────────────────────────────────
# ID del ecosistema y org para las alertas de sistema (notificaciones internas)
ECOSYSTEM_ID=
ECOSYSTEM_ORG_ID=

# ── SSE ───────────────────────────────────────────────────────────────────────
MAX_SSE_CONNECTIONS=100

# ── Runtime ───────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3002
GRPC_PORT=5003
EOF
ok "notificaciones-backend/.env.example"

# =============================================================================
# analytics-backend — puerto 3003 / gRPC 5004
# =============================================================================
cat > "$ROOT/analytics-backend/.env.example" << 'EOF'
# =============================================================================
# analytics-backend — .env.example
# Railway: Root Directory=/  |  Dockerfile Path=analytics-backend/Dockerfile
# Puerto HTTP: 3003  |  Puerto gRPC: 5004
# IMPORTANTE: usar una DB SEPARADA del operacional de chatia
# =============================================================================

# ── PostgreSQL (DB exclusiva — nunca compartir con chatia) ───────────────────
DATABASE_URL=postgresql://user:password@postgres.railway.internal:5432/analytics_db

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account","project_id":"","private_key_id":"","private_key":"","client_email":"","client_id":"","auth_uri":"","token_uri":""}

# ── Proyecciones ──────────────────────────────────────────────────────────────
# true = recalcula proyecciones al iniciar (usar solo en staging/debug)
FORCE_PROJECTION_RUN=false

# ── Cache ─────────────────────────────────────────────────────────────────────
# TTL en milisegundos para cache de queries (default: 5 minutos)
CACHE_TTL_MS=300000

# ── Runtime ───────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3003
GRPC_PORT=5004
EOF
ok "analytics-backend/.env.example"

# =============================================================================
# workers-backend — puerto 3004 / gRPC 5005
# =============================================================================
cat > "$ROOT/workers-backend/.env.example" << 'EOF'
# =============================================================================
# workers-backend — .env.example
# Railway: Root Directory=/  |  Dockerfile Path=workers-backend/Dockerfile
# Puerto HTTP: 3004  |  Puerto gRPC: 5005
# Nota: sin HTTP público de negocio — solo /health, /metrics y /api/v1/dlq
# =============================================================================

# ── PostgreSQL (DB exclusiva) ─────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@postgres.railway.internal:5432/workers_db

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST=redis.railway.internal
REDIS_PORT=6379
REDIS_PASSWORD=

# ── Auth ──────────────────────────────────────────────────────────────────────
JWT_SECRET=
FIREBASE_ADMIN_CREDENTIALS={"type":"service_account","project_id":"","private_key_id":"","private_key":"","client_email":"","client_id":"","auth_uri":"","token_uri":""}

# ── gRPC outbound (red privada Railway) ───────────────────────────────────────
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001
NOTIF_GRPC_URL=notificaciones-backend.railway.internal:5003
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004

# ── Groq (embeddings para FAQ ingest y vector index) ─────────────────────────
GROQ_API_KEY=

# ── Concurrencia de queues (tuning sin redeploy) ──────────────────────────────
# CPU-bound: ajustar según vCPUs del plan Railway
WORKERS_FAQ_INGEST_CONCURRENCY=3
# IO-bound: puede ser más alto
WORKERS_VECTOR_INDEX_CONCURRENCY=5
# IO-bound puro: tolera alta concurrencia
WORKERS_CAMPAIGN_EMAIL_CONCURRENCY=10

# ── Exportaciones analytics ───────────────────────────────────────────────────
# Directorio donde se guardan los archivos generados (Railway Volume o /tmp)
EXPORT_OUTPUT_DIR=/tmp/analytics-exports
# URL base pública para que el cliente descargue el archivo generado
EXPORT_BASE_URL=https://workers-backend.railway.app/exports

# ── Runtime ───────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3004
GRPC_PORT=5005
# Aumentar heap para jobs pesados de PDF/vectores
NODE_OPTIONS=--max-old-space-size=2048
EOF
ok "workers-backend/.env.example"

# =============================================================================
# Resumen
# =============================================================================
echo ""
ok "════════════════════════════════════════════════════════"
ok "  .env.example generados para los 5 servicios"
ok "════════════════════════════════════════════════════════"
echo ""
log "Archivos creados:"
log "  chatia-backend/.env.example          (Puerto 3000 / gRPC 5001)"
log "  pasarelapagos-backend/.env.example   (Puerto 3001 / gRPC 5002)"
log "  notificaciones-backend/.env.example  (Puerto 3002 / gRPC 5003)"
log "  analytics-backend/.env.example       (Puerto 3003 / gRPC 5004)"
log "  workers-backend/.env.example         (Puerto 3004 / gRPC 5005)"
echo ""
warn "CÓMO USAR EN RAILWAY:"
warn "  1. Service → Variables → Import from .env.example"
warn "  2. Completar los valores vacíos con los reales"
warn "  3. DATABASE_URL: Railway la genera automática si usas el plugin PG"
warn "  4. REDIS_HOST/PORT/PASSWORD: Railway los genera con el plugin Redis"
warn "  5. FIREBASE_ADMIN_CREDENTIALS: pegar el JSON del service account en UNA sola línea"
warn "  6. FIREBASE_PRIVATE_KEY en notificaciones: reemplazar saltos de línea por \\n literal"
echo ""
warn "ORDEN DE DEPLOY RECOMENDADO:"
warn "  1. Redis plugin"
warn "  2. PostgreSQL plugin (crear 5 DBs: chatia, pasarelapagos, notificaciones, analytics, workers)"
warn "  3. chatia-backend"
warn "  4. pasarelapagos-backend"
warn "  5. notificaciones-backend"
warn "  6. analytics-backend"
warn "  7. workers-backend  ← último (depende de los gRPC de todos los anteriores)"