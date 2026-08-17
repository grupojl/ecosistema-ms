# =============================================================================
# Makefile — ecosistema-ms
# Targets de un solo caracter: r (repomix) | x (script) | g (git)
# =============================================================================
TIMESTAMP := $(shell date +"%Y-%m-%d %H:%M:%S")

.PHONY: r x g git-empty install build build-packages \
        build-chatia build-pagos build-notificaciones build-analytics build-workers \
        dev dev-chatia dev-pagos dev-notificaciones dev-analytics dev-workers \
        lint lint-chatia lint-pagos \
        typecheck typecheck-chatia typecheck-pagos \
        typecheck-notificaciones typecheck-analytics typecheck-workers typecheck-new \
        test test-chatia test-pagos \
        test-notificaciones test-analytics test-workers test-new \
        docker-up docker-down docker-reset docker-logs \
        migrate-chatia migrate-pagos migrate-all \
        migrate-notificaciones migrate-analytics migrate-workers migrate-all-new \
        migrate-deploy-chatia migrate-deploy-pagos \
        migrate-deploy-notificaciones migrate-deploy-analytics migrate-deploy-workers \
        generate-chatia generate-pagos generate-all \
        generate-notificaciones generate-analytics generate-workers \
        railway-chatia railway-pagos \
        railway-notificaciones railway-analytics railway-workers railway-all-new \
        seed-chatia setup queue-stats help

help:
	@echo "================================================="
	@echo "  ecosistema-ms"
	@echo "================================================="
	@echo ""
	@echo "  make r             → repomix + copia XMLs a Downloads"
	@echo "  make x             → ejecuta x.sh (script activo)"
	@echo "  make g             → git add + commit + push"
	@echo "  make git-empty     → empty commit → fuerza redeploy Railway"
	@echo ""
	@echo "  make dev           → todos los servicios en watch"
	@echo "  make dev-chatia    → solo chatia-backend"
	@echo "  make dev-pagos     → solo pasarelapagos-backend"
	@echo "  make dev-notificaciones → solo notificaciones-backend"
	@echo "  make dev-analytics → solo analytics-backend"
	@echo "  make dev-workers   → solo workers-backend"
	@echo ""
	@echo "  make docker-up     → levanta postgres + redis local"
	@echo "  make docker-down   → detiene contenedores"
	@echo "  make docker-reset  → detiene + borra volúmenes"
	@echo ""
	@echo "  make migrate-all       → prisma migrate dev (chatia + pagos)"
	@echo "  make migrate-all-new   → prisma migrate dev (notif + analytics + workers)"
	@echo "  make migrate-chatia    → prisma migrate dev chatia"
	@echo "  make migrate-pagos     → prisma migrate dev pagos"
	@echo ""
	@echo "  make typecheck     → typecheck workspace completo"
	@echo "  make test          → tests workspace completo"
	@echo "  make build         → build workspace completo"
	@echo "  make setup         → install + docker-up + migrate-all"
	@echo "================================================="

# ─────────────────────────────────────────────────────────────────────────────
# R — REPOMIX → genera XMLs y los copia a Downloads
# ─────────────────────────────────────────────────────────────────────────────
r:
	npx repomix --config repomix.config.json
	npx repomix --config repomix.infra.json
	cp ecosistema-ms.xml "/c/Users/Agustin/Downloads/ecosistema-ms.xml"
	cp ecosistema-ms-infra.xml "/c/Users/Agustin/Downloads/ecosistema-ms-infra.xml"
	@echo "[+] XMLs copiados a Downloads"

# ─────────────────────────────────────────────────────────────────────────────
# X — ejecuta bash x.sh (el script activo en la raíz)
# ─────────────────────────────────────────────────────────────────────────────
x:
	@[ -f x.sh ] || (echo "[✗] No existe x.sh en la raíz"; exit 1)
	@echo "=== Ejecutando x.sh ==="
	@bash x.sh

# ─────────────────────────────────────────────────────────────────────────────
# G — GIT: add + commit timestamp + push
# ─────────────────────────────────────────────────────────────────────────────
g:
	@echo "=== Git: add + commit + push ==="
	@git add .
	@{ git commit -m "chore: $(TIMESTAMP)" 2>/dev/null && \
	   git push origin main && \
	   echo "[✓] pusheado"; } || \
	   echo "[!] sin cambios o ya pusheado"

# ─────────────────────────────────────────────────────────────────────────────
# GIT EMPTY — fuerza redeploy en Railway sin cambios de código
# ─────────────────────────────────────────────────────────────────────────────
git-empty:
	@echo "=== Empty commit → fuerza redeploy Railway ==="
	@git commit --allow-empty -m "chore: redeploy $(TIMESTAMP)"
	@git push origin main
	@echo "[✓] Redeploy disparado"

# ─────────────────────────────────────────────────────────────────────────────
# INSTALACIÓN Y BUILD
# ─────────────────────────────────────────────────────────────────────────────
install:
	pnpm install

build:
	pnpm --filter "./packages/*" build
	pnpm --filter chatia-backend build
	pnpm --filter pasarelapagos-backend build
	pnpm --filter notificaciones-backend build
	pnpm --filter analytics-backend build
	pnpm --filter workers-backend build

build-packages:
	pnpm --filter "./packages/*" build

build-chatia:
	pnpm --filter chatia-backend build

build-pagos:
	pnpm --filter pasarelapagos-backend build

build-notificaciones:
	pnpm --filter notificaciones-backend build

build-analytics:
	pnpm --filter analytics-backend build

build-workers:
	pnpm --filter workers-backend build

# ─────────────────────────────────────────────────────────────────────────────
# DESARROLLO
# ─────────────────────────────────────────────────────────────────────────────
dev:
	pnpm --parallel \
		--filter chatia-backend \
		--filter pasarelapagos-backend \
		--filter notificaciones-backend \
		--filter analytics-backend \
		--filter workers-backend \
		start:dev

dev-chatia:
	pnpm --filter chatia-backend start:dev

dev-pagos:
	pnpm --filter pasarelapagos-backend start:dev

dev-notificaciones:
	pnpm --filter notificaciones-backend start:dev

dev-analytics:
	pnpm --filter analytics-backend start:dev

dev-workers:
	pnpm --filter workers-backend start:dev

# ─────────────────────────────────────────────────────────────────────────────
# CALIDAD DE CÓDIGO
# ─────────────────────────────────────────────────────────────────────────────
lint:
	pnpm --recursive lint

lint-chatia:
	pnpm --filter chatia-backend lint

lint-pagos:
	pnpm --filter pasarelapagos-backend lint

typecheck:
	pnpm --recursive typecheck

typecheck-chatia:
	pnpm --filter chatia-backend typecheck

typecheck-pagos:
	pnpm --filter pasarelapagos-backend typecheck

typecheck-notificaciones:
	pnpm --filter notificaciones-backend typecheck

typecheck-analytics:
	pnpm --filter analytics-backend typecheck

typecheck-workers:
	pnpm --filter workers-backend typecheck

typecheck-new: typecheck-notificaciones typecheck-analytics typecheck-workers

test:
	pnpm --recursive test

test-chatia:
	pnpm --filter chatia-backend test

test-pagos:
	pnpm --filter pasarelapagos-backend test

test-notificaciones:
	pnpm --filter notificaciones-backend test

test-analytics:
	pnpm --filter analytics-backend test

test-workers:
	pnpm --filter workers-backend test

test-new: test-notificaciones test-analytics test-workers

test-cov:
	pnpm --recursive test:cov

# ─────────────────────────────────────────────────────────────────────────────
# DOCKER
# ─────────────────────────────────────────────────────────────────────────────
docker-up:
	docker compose up -d
	@echo "[✓] Infra local lista"
	@echo "  postgres chatia  → localhost:5434"
	@echo "  postgres pagos   → localhost:5435"
	@echo "  redis            → localhost:6380"

docker-down:
	docker compose down

docker-reset:
	docker compose down -v
	@echo "[!] Volúmenes eliminados"

docker-logs:
	docker compose logs -f

# ─────────────────────────────────────────────────────────────────────────────
# PRISMA — migrate dev
# ─────────────────────────────────────────────────────────────────────────────
migrate-chatia:
	pnpm --filter chatia-backend prisma:migrate:dev

migrate-pagos:
	cd pasarelapagos-backend && pnpm exec prisma migrate dev

migrate-notificaciones:
	cd notificaciones-backend && pnpm exec prisma migrate dev

migrate-analytics:
	cd analytics-backend && pnpm exec prisma migrate dev

migrate-workers:
	cd workers-backend && pnpm exec prisma migrate dev

migrate-all: migrate-chatia migrate-pagos

migrate-all-new: migrate-notificaciones migrate-analytics migrate-workers

# ─────────────────────────────────────────────────────────────────────────────
# PRISMA — migrate deploy (producción)
# ─────────────────────────────────────────────────────────────────────────────
migrate-deploy-chatia:
	pnpm --filter chatia-backend start:migrate

migrate-deploy-pagos:
	pnpm --filter pasarelapagos-backend start:migrate

migrate-deploy-notificaciones:
	pnpm --filter notificaciones-backend start:migrate

migrate-deploy-analytics:
	pnpm --filter analytics-backend start:migrate

migrate-deploy-workers:
	pnpm --filter workers-backend start:migrate

# ─────────────────────────────────────────────────────────────────────────────
# PRISMA — generate
# ─────────────────────────────────────────────────────────────────────────────
generate-chatia:
	cd chatia-backend && pnpm exec prisma generate

generate-pagos:
	cd pasarelapagos-backend && pnpm exec prisma generate

generate-notificaciones:
	cd notificaciones-backend && pnpm exec prisma generate

generate-analytics:
	cd analytics-backend && pnpm exec prisma generate

generate-workers:
	cd workers-backend && pnpm exec prisma generate

generate-all: generate-chatia generate-pagos generate-notificaciones generate-analytics generate-workers

seed-chatia:
	cd chatia-backend && pnpm exec ts-node prisma/seed-welver.ts

# ─────────────────────────────────────────────────────────────────────────────
# RAILWAY — build Docker local
# ─────────────────────────────────────────────────────────────────────────────
railway-chatia:
	docker build -f chatia-backend/Dockerfile -t ecosistema-ms/chatia-backend:local .
	@echo "[✓] ecosistema-ms/chatia-backend:local"

railway-pagos:
	docker build -f pasarelapagos-backend/Dockerfile -t ecosistema-ms/pasarelapagos-backend:local .
	@echo "[✓] ecosistema-ms/pasarelapagos-backend:local"

railway-notificaciones:
	docker build -f notificaciones-backend/Dockerfile -t ecosistema-ms/notificaciones-backend:local .
	@echo "[✓] ecosistema-ms/notificaciones-backend:local"

railway-analytics:
	docker build -f analytics-backend/Dockerfile -t ecosistema-ms/analytics-backend:local .
	@echo "[✓] ecosistema-ms/analytics-backend:local"

railway-workers:
	docker build -f workers-backend/Dockerfile -t ecosistema-ms/workers-backend:local .
	@echo "[✓] ecosistema-ms/workers-backend:local"

railway-all-new: railway-notificaciones railway-analytics railway-workers

# ─────────────────────────────────────────────────────────────────────────────
# UTILS
# ─────────────────────────────────────────────────────────────────────────────
queue-stats:
	curl -s http://localhost:3004/api/v1/dlq/stats | jq .

# ─────────────────────────────────────────────────────────────────────────────
# SETUP INICIAL
# ─────────────────────────────────────────────────────────────────────────────
setup: install docker-up migrate-all
	@echo ""
	@echo "[✓] ecosistema-ms listo"
	@echo ""
	@echo "  1. Editar chatia-backend/.env"
	@echo "  2. Editar pasarelapagos-backend/.env"
	@echo "  3. make seed-chatia"
	@echo "  4. make dev"
	@echo ""