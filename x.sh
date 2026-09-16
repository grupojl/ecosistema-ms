#!/usr/bin/env bash
# =============================================================================
# fix-claude-docs-ecosistema-ms.sh
# Fix puntual: agrega Trivy + Cosign al deploy-railway.md
# y corrige la sección duplicada en AUDIT-LAST.md
# Sin python. Git Bash compatible.
# Ejecutar desde la raíz del monorepo ecosistema-ms/
# =============================================================================
set -euo pipefail

echo ""
echo "=== fix-claude-docs-ecosistema-ms.sh ==="
echo ""

# =============================================================================
# 1. deploy-railway.md — agregar sección CI/CD con Trivy y Cosign
#    El archivo ya tiene todo el checklist Docker correcto.
#    Solo falta la sección de GitHub Actions/CI.
# =============================================================================
echo "▶ .claude/checklists/deploy-railway.md — agregando sección CI/CD..."

cat >> .claude/checklists/deploy-railway.md << 'EOF'

## CI/CD — GitHub Actions por servicio

- [ ] `pnpm audit --audit-level=high` — falla si hay CVE crítico o alto
- [ ] Build con `--platform linux/amd64` explícito en el workflow
- [ ] **Trivy** escanea la imagen final — exit-code 1 en CRITICAL/HIGH con fix disponible
- [ ] **Cosign** firma la imagen en push a main (keyless OIDC)
- [ ] Path filters: el workflow solo corre cuando cambia `{servicio}/` o `packages/`
- [ ] Permisos: `packages: write` + `id-token: write` en el job

Ver template completo en `architecture/05-dockerfile-backend.md` (sección GitHub Actions).
EOF

echo "  ✓ deploy-railway.md — sección CI/CD agregada"

# =============================================================================
# 2. AUDIT-LAST.md — eliminar la sección duplicada
#    El script anterior corrió dos veces y dejó la sección de actualización duplicada.
#    Estrategia: reconstruir el archivo manteniendo solo la primera ocurrencia.
# =============================================================================
echo "▶ .claude/AUDIT-LAST.md — eliminando sección duplicada..."

TMPFILE=".claude/AUDIT-LAST.md.tmp"
FOUND_SECTION=0
SKIP=0

while IFS= read -r line; do

  # Detectar el inicio de la sección de actualización
  if echo "$line" | grep -q "^## Actualización 2026-09-16"; then
    if [ "$FOUND_SECTION" = "0" ]; then
      # Primera ocurrencia — la mantenemos
      FOUND_SECTION=1
      printf '%s\n' "$line"
    else
      # Segunda ocurrencia — la saltamos junto con todo lo que sigue
      SKIP=1
    fi
    continue
  fi

  # Si estamos en la sección duplicada, no escribir nada
  if [ "$SKIP" = "1" ]; then
    continue
  fi

  printf '%s\n' "$line"

done < ".claude/AUDIT-LAST.md" > "$TMPFILE"

mv "$TMPFILE" ".claude/AUDIT-LAST.md"
echo "  ✓ AUDIT-LAST.md — sección duplicada eliminada"

# =============================================================================
# Verificación
# =============================================================================
echo ""
echo "=== Verificación ==="
grep -c "Trivy" .claude/checklists/deploy-railway.md | xargs -I{} echo "  deploy-railway — Trivy: {} ocurrencia(s) (esperado: >=1)"
grep -c "Cosign" .claude/checklists/deploy-railway.md | xargs -I{} echo "  deploy-railway — Cosign: {} ocurrencia(s) (esperado: >=1)"
grep -c "Actualización 2026-09-16" .claude/AUDIT-LAST.md | xargs -I{} echo "  AUDIT-LAST — secciones de actualización: {} (esperado: 1)"

echo ""
echo "✅ Done — ecosistema-ms"
echo "   Commit: git add .claude && git commit -m 'docs(claude): fix deploy-railway Trivy+Cosign + AUDIT-LAST dedup' 