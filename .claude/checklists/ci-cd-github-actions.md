# Checklist — CI/CD con GitHub Actions por servicio

## Antes de crear el workflow

- [ ] El servicio tiene `scripts.test` en su `package.json`
- [ ] El servicio tiene `scripts.test:cov` que corre jest con `--coverage`
- [ ] El servicio tiene `scripts.typecheck` que corre `tsc --noEmit`
- [ ] El servicio tiene `scripts.lint` que corre eslint
- [ ] `jest.config.ts` tiene `coverageThreshold` configurado (85%)

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
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '10' }
      - uses: actions/setup-node@v4
        with: { node-version: '24', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter={servicio} lint
      - run: pnpm --filter={servicio} typecheck
      - run: pnpm --filter={servicio} test:cov
      - run: docker build -f {servicio}/Dockerfile -t {servicio}:ci .
        if: github.ref == 'refs/heads/main'
```

## Branch protection en GitHub

Settings → Branches → Branch protection rules → `main`:
- [x] Require status checks before merging
  - [x] ci (de cada workflow activo)
- [x] Require pull request reviews before merging (1 aprobación)
- [x] Do not allow bypassing the above settings

## Criterio de completado

- El PR de un servicio que falla typecheck no puede mergearse
- El PR que baja coverage < 85% no puede mergearse
- El merge a main dispara el build Docker y verifica que la imagen se construye
