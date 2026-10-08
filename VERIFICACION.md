# Build checklist — ecosistema-ms

## 1. Prisma generate por servicio

```bash
pnpm --filter chatia-backend exec prisma generate
pnpm --filter pasarelapagos-backend exec prisma generate
pnpm --filter notificaciones-backend exec prisma generate
pnpm --filter analytics-backend exec prisma generate
pnpm --filter workers-backend exec prisma generate
pnpm --filter marketing-backend exec prisma generate
```

## 2. Paquetes compartidos (logger, metrics, proto, grpc-client, auth-server)

```bash
pnpm build:packages
```

## 3. Typecheck + build por servicio

```bash
pnpm --filter chatia-backend typecheck
pnpm --filter chatia-backend build
pnpm --filter pasarelapagos-backend typecheck
pnpm --filter pasarelapagos-backend build
pnpm --filter notificaciones-backend typecheck
pnpm --filter notificaciones-backend build
pnpm --filter analytics-backend typecheck
pnpm --filter analytics-backend build
pnpm --filter workers-backend typecheck
pnpm --filter workers-backend build
pnpm --filter marketing-backend typecheck
pnpm --filter marketing-backend build
```

## Atajo (todo junto)

```bash
pnpm typecheck && pnpm build
```

## Notas

- `chatia-backend` y `pasarelapagos-backend` ya incluyen `prisma generate` en su script `build`. Los otros cuatro no, así que sin el paso 1 el typecheck puede fallar por el cliente Prisma sin generar.
- `marketing-backend` no tiene `prisma.config.ts`, solo `schema.prisma`. Si `prisma generate` falla ahí, revisar eso primero.
- El `build` raíz ya corre `build:packages` antes que los servicios. El paso 2 solo hace falta si corrés los `typecheck` por separado.
