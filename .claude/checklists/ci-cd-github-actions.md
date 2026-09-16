# Checklist — CI/CD con GitHub Actions por servicio

Ver template completo en `architecture/05-dockerfile-backend.md` (sección GitHub Actions).

---

## Antes de crear el workflow

- [ ] El servicio tiene `scripts.test:cov` que corre jest con `--coverage`
- [ ] El servicio tiene `scripts.typecheck` que corre `tsc --noEmit`
- [ ] El servicio tiene `scripts.lint` que corre eslint
- [ ] `jest.config.ts` tiene `coverageThreshold` configurado (85%)
- [ ] El servicio tiene `entrypoint.sh` con `prisma migrate deploy` + `exec node`

## Estructura del workflow (copiar y adaptar)

```yaml
# .github/workflows/ci-{servicio}.yml
name: CI — {servicio}

on:
  push:
    branches: [main]
    paths:
      - '{servicio}/**'
      - 'packages/**'
      - 'package.json'
      - 'pnpm-workspace.yaml'
  pull_request:
    paths:
      - '{servicio}/**'
      - 'packages/**'

jobs:
  ci:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write      # push a GHCR
      id-token: write      # Cosign OIDC keyless signing

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '10' }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile

      # ── Calidad ────────────────────────────────────────────────────────────
      - run: pnpm --filter={servicio} lint
      - run: pnpm --filter={servicio} typecheck
      - run: pnpm --filter={servicio} test:cov

      # ── Auditoría de dependencias npm ─────────────────────────────────────
      - run: pnpm audit --audit-level=high

      # ── Build de imagen Docker ────────────────────────────────────────────
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        if: github.ref == 'refs/heads/main'
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: {servicio}/Dockerfile
          platforms: linux/amd64
          push: ${{ github.ref == 'refs/heads/main' }}
          tags: ghcr.io/${{ github.repository }}/{servicio}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      # ── Escaneo de vulnerabilidades (Trivy) ───────────────────────────────
      - name: Scan image — Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ghcr.io/${{ github.repository }}/{servicio}:${{ github.sha }}
          format: table
          exit-code: '1'
          severity: CRITICAL,HIGH
          ignore-unfixed: true

      # ── Firma de imagen (Cosign keyless) ──────────────────────────────────
      - name: Sign image — Cosign
        if: github.ref == 'refs/heads/main'
        uses: sigstore/cosign-installer@v3
      - run: cosign sign --yes ghcr.io/${{ github.repository }}/{servicio}:${{ github.sha }}
        if: github.ref == 'refs/heads/main'
        env: { COSIGN_EXPERIMENTAL: '1' }
```

## Workflows a crear (uno por servicio)

- [ ] **[E5-01]** `.github/workflows/ci-chatia-backend.yml`
- [ ] **[E5-02]** `.github/workflows/ci-pasarelapagos-backend.yml`
- [ ] **[E5-03]** `.github/workflows/ci-notificaciones-backend.yml`
- [ ] **[E5-04]** `.github/workflows/ci-analytics-backend.yml`
- [ ] **[E5-05]** `.github/workflows/ci-workers-backend.yml`

## Branch protection en GitHub

Settings → Branches → Branch protection rules → `main`:
- [x] Require status checks before merging
  - [x] ci (de cada workflow activo)
- [x] Require pull request reviews before merging (1 aprobación)
- [x] Do not allow bypassing the above settings

## Criterio de completado

- Typecheck falla → PR no se mergea
- Coverage < 85% → PR no se mergea
- Trivy encuentra CVE CRITICAL/HIGH con fix → build falla
- Push a main → imagen firmada con Cosign en GHCR
