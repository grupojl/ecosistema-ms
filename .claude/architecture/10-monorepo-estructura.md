# 10 — Estructura de monorepo: hacia 10/10

> Referentes: **Vercel (Turborepo)** · **Nx/Nrwl** · **Google (Bazel)**
>
> Norte: dado cualquier cambio en el repo, el sistema sabe exactamente qué
> buildear, qué testear y qué deployar — sin buildear nada de más.

---

## Por qué este monorepo ya tiene buena estructura

Los 3 monorepos de GrupoJL tienen workspace organization correcta y
dependency graph bien modelado. El gap con el 10/10 es de **orquestación
y enforcement** — no de estructura.

**ecosistema-ms** tiene la mejor estructura de los 3 monorepos: 5 packages
con roles explícitos (logger, metrics, auth-server, grpc-client, proto) + 6 servicios.
Turborepo + dependency-cruiser completan el 10/10.

---

## Nivel 1 — Bloqueante (hacer antes del próximo deploy)

### 1.1 Regenerar lockfile tras deps nuevas

Cada vez que se agrega una dep al catalog, el lockfile queda desincronizado.
CI falla en el primer `pnpm install --frozen-lockfile`.

```bash
pnpm install
git add pnpm-lock.yaml
git commit -m "chore: regenerar lockfile"
```

**Regla permanente:** toda sesión que agrega deps termina con `pnpm install`
y el lockfile commiteado. Sin excepción.

### 1.2 Branch protection en GitHub

Sin esto los CI existen pero no bloquean merge.
Settings → Branches → Add rule → main → Required status checks:

| Check requerido | Workflow |
|----------------|----------|
| ci-chatia | typecheck + test + build |
| ci-pasarelapagos | typecheck + test + build |
| ci-packages | typecheck auth-server + grpc-client + build logger + metrics |

---

## Nivel 2 — Turborepo (próximo sprint)

### 2.1 Instalar Turborepo

```bash
pnpm add turbo --save-dev -w
```

### 2.2 `turbo.json` en la raíz

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "start:dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

**Qué resuelve:** cuando cambia `packages/auth-server`, Turborepo sabe
que tiene que rebuildear los 5 servicios que lo consumen — en paralelo
y solo los afectados.

### 2.3 Reemplazar scripts en `package.json` raíz

```json
"scripts": {
  "build":     "turbo build",
  "typecheck": "turbo typecheck",
  "test":      "turbo test",
  "dev":       "turbo dev"
}
```

### 2.4 Caché remota en CI

```yaml
- name: Setup Turborepo cache
  uses: rharkor/caching-for-turbo@v1.8
```

---

## Nivel 3 — dependency-cruiser (enforcement de fronteras)

La regla "ningún servicio importa de otro servicio" y
"ningún servicio reimplementa Firebase sin @ecosistema-ms/auth-server"
son hoy manuales. dependency-cruiser las automatiza.

```bash
pnpm add dependency-cruiser --save-dev -w
```

**`.dependency-cruiser.cjs`:**
```js
const SERVICES = [
  'chatia-backend',
  'pasarelapagos-backend',
  'notificaciones-backend',
  'analytics-backend',
  'workers-backend',
  'marketing-backend',
];

const crossServiceRules = SERVICES.flatMap(from =>
  SERVICES
    .filter(to => to !== from)
    .map(to => ({
      name: `no-cross-import-${from}-to-${to}`,
      severity: 'error',
      from: { path: `^${from}/src` },
      to:   { path: `^${to}/src` },
    }))
);

module.exports = {
  forbidden: [
    ...crossServiceRules,
    {
      name: 'no-local-firebase-verify',
      severity: 'error',
      comment: 'Usar @ecosistema-ms/auth-server — nunca reimplementar firebase-admin directamente',
      from: { path: '^(chatia|pasarelapagos|notificaciones|analytics|workers)-backend/src',
              pathNot: 'firebase/firebase.module' },
      to:   { path: 'firebase-admin' },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
```

---

## Estado actual vs 10/10

| Item | Estado |
|------|--------|
| pnpm workspaces + catalog completo | ✅ |
| packages/ con roles explícitos (5 packages) | ✅ |
| Build order correcto (packages → servicios) | ✅ |
| path filters en CI (6 workflows) | ✅ |
| pnpm store cacheado en CI (config) | ✅ |
| Lockfile actualizado | ⏳ `pnpm install` pendiente |
| Branch protection en GitHub | ❌ Nivel 1.2 |
| Turborepo task graph | ❌ Nivel 2 |
| dependency-cruiser (cross-service) | ❌ Nivel 3 |
| Turbo remote cache | ❌ Nivel 2.4 |

---

## Reglas duras de monorepo

🔴 Nunca mergear con lockfile desactualizado.
🔴 Ningún servicio importa de otro servicio — solo de packages/*.
🔴 Ningún servicio reimplementa Firebase directamente — usar @ecosistema-ms/auth-server.
🔴 Toda dep nueva va primero al catalog de pnpm-workspace.yaml.
🟡 Versiones de @nestjs/* alineadas con welver.
🟡 Cuando cambia la firma de un export en packages/auth-server → bump version minor.
