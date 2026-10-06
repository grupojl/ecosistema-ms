# Environments — Entornos del ecosistema MS

> Última actualización: 2026-10-03
> Regla: cada entorno nuevo requiere actualizar este archivo + los `.env.example`
> de los servicios afectados antes de hacer el primer deploy.

---

## Mapa de entornos

```
DESARROLLO (local)
     ↓
RAILWAY (staging + primer producción)
     ↓
HETZNER — Producción económica
     ↓
AWS — Producción tope de gama
  ├── Preproducción (staging productivo)
  └── Producción
```

---

## 1. Desarrollo (local)

**Estado:** ✅ Activo
**Plataforma:** Windows + Git Bash · Node.js · pnpm workspaces
**Infraestructura local:** Docker Compose — PostgreSQL × 6 + Redis

**Cómo levantar:**
```bash
docker-compose up -d        # PostgreSQL × 6 + Redis
pnpm install

# Cada servicio en una terminal
pnpm --filter chatia-backend run start:dev
pnpm --filter pasarelapagos-backend run start:dev
pnpm --filter analytics-backend run start:dev
pnpm --filter notificaciones-backend run start:dev
pnpm --filter workers-backend run start:dev
pnpm --filter marketing-backend run start:dev
```

**Puertos locales:**
| Servicio | HTTP | gRPC |
|---------|------|------|
| chatia-backend | 3001 | 5001 |
| pasarelapagos-backend | 3001 | 5002 |
| analytics-backend | 3001 | 5004 |
| notificaciones-backend | 3001 | 5003 |
| workers-backend | 3001 | 5005 |
| marketing-backend | 3001 | 5006 |

**URLs gRPC locales:**
```bash
CHATIA_GRPC_URL=localhost:5001
PAGOS_GRPC_URL=localhost:5002
NOTIFICACIONES_GRPC_URL=localhost:5003
ANALYTICS_GRPC_URL=localhost:5004
WORKERS_GRPC_URL=localhost:5005
MARKETING_GRPC_URL=localhost:5006
```

**Diferencias con producción:**
- `NODE_ENV=development`
- Firebase: proyecto de desarrollo separado por ecosistema
- Proveedor de pago: Fake habilitado
- Groq: cuenta de desarrollo (rate limits más bajos)
- gRPC sin TLS
- Sin AOF en Redis

---

## 2. Railway (staging / primer deploy productivo)

**Estado:** ✅ Activo — entorno actual de producción
**Plataforma:** Railway.app
**Modelo:** monorepo en GitHub, 6 servicios independientes por Dockerfile

**Servicios en Railway:**

| Servicio | Dockerfile | Root Dir | Puerto gRPC |
|---------|-----------|----------|------------|
| chatia-backend | `chatia-backend/Dockerfile` | `/` | 5001 |
| pasarelapagos-backend | `pasarelapagos-backend/Dockerfile` | `/` | 5002 |
| notificaciones-backend | `notificaciones-backend/Dockerfile` | `/` | 5003 |
| analytics-backend | `analytics-backend/Dockerfile` | `/` | 5004 |
| workers-backend | `workers-backend/Dockerfile` | `/` | 5005 |
| marketing-backend | `marketing-backend/Dockerfile` | `/` | 5006 |

**Infraestructura:**
- PostgreSQL: plugin dedicado por servicio backend
- Redis: plugin compartido entre todos los servicios
- gRPC: red privada Railway (`*.railway.internal`) — HTTP/2 sin TLS en red interna

**URLs internas Railway:**
```bash
CHATIA_GRPC_URL=chatia-backend.railway.internal:5001
PAGOS_GRPC_URL=pasarelapagos-backend.railway.internal:5002
NOTIFICACIONES_GRPC_URL=notificaciones-backend.railway.internal:5003
ANALYTICS_GRPC_URL=analytics-backend.railway.internal:5004
WORKERS_GRPC_URL=workers-backend.railway.internal:5005
MARKETING_GRPC_URL=marketing-backend.railway.internal:5006
```

**Migraciones:** automáticas en `entrypoint.sh` (`prisma migrate deploy`)

**Limitaciones conocidas:**
- gRPC sobre la red privada de Railway — verificar que HTTP/2 esté habilitado
- Redis compartido — si un servicio satura Redis afecta a todos
- Sin persistencia AOF en Redis — jobs BullMQ se pierden en restart

---

## 3. Hetzner — Producción económica

**Estado:** 🔲 Planificado — siguiente fase después de Railway
**Plataforma:** Hetzner Cloud
**Modelo:** Docker Compose con Caddy como reverse proxy

**Infraestructura objetivo:**

```
Hetzner Cloud
├── Load Balancer (Hetzner LB)
│   ├── HTTP/HTTPS → servicios frontend / API REST
│   └── gRPC (HTTP/2) → servicios backend inter-servicio
├── Servidor app principal (CX52 o superior)
│   ├── chatia-backend          (HTTP :3001 + gRPC :5001)
│   ├── pasarelapagos-backend   (HTTP :3002 + gRPC :5002)
│   ├── analytics-backend       (HTTP :3003 + gRPC :5004)
│   ├── notificaciones-backend  (HTTP :3004 + gRPC :5003)
│   ├── workers-backend         (HTTP :3005 + gRPC :5005)
│   └── marketing-backend       (HTTP :3006 + gRPC :5006)
├── Servidores DB (CPX31 × 2 o Managed DB)
│   ├── PostgreSQL cluster A (chatia, pagos, analytics)
│   └── PostgreSQL cluster B (notificaciones, workers, marketing)
└── Servidor Redis (CX21)
    └── Redis con AOF + RDB persistence
```

**Diferencias críticas vs Railway para gRPC:**
- El load balancer de Hetzner necesita configuración explícita para HTTP/2
- Caddy soporta gRPC nativo — usar `reverse_proxy h2c://backend:5001`
- TLS entre servicios: evaluarse — mTLS en red privada de Hetzner

**Checklist antes de migrar a Hetzner:**
- [ ] GitHub Actions pipeline CI/CD por servicio
- [ ] Caddy config con HTTP/2 + gRPC + SSL automático
- [ ] Redis AOF habilitado
- [ ] `pg_dump` cron backup diario por base de datos
- [ ] Health checks externos por servicio (Better Uptime o similar)
- [ ] Fallback de auth decidido e implementado (ver `providers.md`)
- [ ] Circuit breaker en todos los clientes gRPC
- [ ] `.env.example` completo por servicio
- [ ] Proveedor Fake deshabilitado en `NODE_ENV=production`
- [ ] DLQ guard en `workers-backend` (endpoint sin auth actualmente)
- [ ] Redis separado por servicio o namespacing de keys

---

## 4. AWS — Producción tope de gama

**Estado:** 🔲 Roadmap — fase final de escalabilidad global
**Plataforma:** Amazon Web Services
**Modelo:** ECS Fargate + RDS + ElastiCache + ALB con soporte gRPC

### 4a. Preproducción AWS

**Propósito:** staging productivo — mismo entorno que producción, tráfico interno.
Toda feature pasa por preproducción antes de ir a producción.

**Infraestructura:**
```
AWS (eu-west-1 — Frankfurt, buena latencia LATAM + Europa)
├── ECS Fargate cluster preprod
│   └── Task por servicio (mismas imágenes que prod, tag distinto)
├── RDS PostgreSQL × 2 (instancias small — db.t3.medium)
├── ElastiCache Redis (cache.t3.micro)
└── ALB con soporte HTTP/2 para gRPC
```

**Diferencias vs producción:**
```bash
NODE_ENV=production          # igual — queremos detectar bugs de prod
# DBs separadas de producción
# Firebase: mismo proyecto o staging según política
# Groq: misma API key o key de staging
```

### 4b. Producción AWS

**Infraestructura objetivo:**

```
AWS (multi-región)
├── Route 53 (DNS + health checks por servicio)
├── ALB (HTTP/2 + gRPC)
│   └── Target groups por servicio
├── ECS Fargate (auto-scaling por servicio)
│   ├── chatia-backend          (min 2 tasks — crítico)
│   ├── pasarelapagos-backend   (min 2 tasks — crítico)
│   ├── analytics-backend       (min 1 task — puede degradar)
│   ├── notificaciones-backend  (min 2 tasks — crítico)
│   ├── workers-backend         (min 2 tasks — jobs BullMQ)
│   └── marketing-backend       (min 1 task — puede degradar)
├── RDS PostgreSQL Multi-AZ
│   ├── Cluster A: chatia + pagos + analytics
│   └── Cluster B: notificaciones + workers + marketing
├── ElastiCache Redis Cluster (AOF + replicación)
├── S3 (assets, documentos de knowledge base)
└── SES como alternativa a SendGrid (evaluar en este punto)
```

**Lo que cambia vs Hetzner:**
- Auto-scaling real — chatia y pagos escalan según tráfico
- RDS Multi-AZ — failover automático en < 60s
- ElastiCache con replicación — Redis no es single point of failure
- ALB nativo con HTTP/2 — gRPC sin configuración especial de Caddy
- Secrets Manager — variables sensibles no en env planas
- VPC privada — los backends no tienen IP pública
- Service mesh opcional (App Mesh) para mTLS entre servicios

**Checklist antes de migrar a AWS:**
- [ ] Terraform o CDK para infraestructura como código
- [ ] ECR como registry de imágenes Docker
- [ ] ECS task definitions por servicio con health checks
- [ ] RDS Multi-AZ por cluster
- [ ] ElastiCache con replicación habilitada
- [ ] ALB configurado para HTTP/2 + gRPC
- [ ] AWS Secrets Manager para todas las variables sensibles
- [ ] WAF en el ALB (OWASP rules + rate limiting por IP)
- [ ] CloudWatch + alarmas por servicio (latencia gRPC, error rate, queue depth)
- [ ] Runbook de incident response actualizado
- [ ] Circuit breaker validado en todos los clientes gRPC bajo carga

---

## Comparación de entornos

| Dimensión | Desarrollo | Railway | Hetzner | AWS Preprod | AWS Prod |
|-----------|-----------|---------|---------|-------------|----------|
| Costo | $0 | Bajo | Medio | Medio-alto | Alto |
| gRPC | localhost | Red privada Railway | Caddy HTTP/2 | ALB HTTP/2 | ALB HTTP/2 |
| HA / Failover | No | Parcial | Manual | Sí | Sí |
| Auto-scaling | No | Básico | No | Sí | Sí |
| Redis AOF | No | No | Sí | Sí | Sí |
| DB backup | No | Plugin | Manual | RDS auto | RDS auto |
| Observabilidad | Logs | Logs | Grafana | CloudWatch | CloudWatch |
| Fake provider | Sí | No | No | No | No |
| Estado | ✅ Activo | ✅ Activo | 🔲 Próximo | 🔲 Roadmap | 🔲 Roadmap |

---

## Política de promoción entre entornos

```
feature branch
     ↓ PR aprobado
main (Railway — staging)
     ↓ tag vX.Y.Z + smoke tests
Hetzner (producción económica)
     ↓ validación con tráfico real
AWS Preproducción
     ↓ smoke tests + aprobación manual
AWS Producción
```

**Reglas duras:**
- Ningún cambio va a Hetzner sin haber corrido en Railway primero
- Ningún cambio va a AWS producción sin haber pasado por AWS preproducción
- El proveedor Fake nunca puede estar activo fuera de desarrollo
- Toda migración de schema (`prisma migrate deploy`) se ejecuta antes de levantar el servicio

