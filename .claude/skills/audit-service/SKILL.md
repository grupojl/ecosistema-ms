---
name: audit-service
description: Auditar y puntuar de 1 a 10 un microservicio del monorepo con una rúbrica fija y métricas medidas (no opinión), y actualizar AUDIT-LAST.md. Usar cuando el usuario pida "puntuá", "reauditá", "qué nota tiene", "cómo está el servicio X" o compare servicios entre sí.
---

# audit-service — la nota sale de mediciones, no de opiniones

## Procedimiento (en este orden, sin saltear pasos)
1. **Medir**: `node .claude/skills/audit-service/scripts/metrics.js <servicio-backend>` (agregar `--json` para guardarlo).
2. **Verificar**: correr el skill `verify` (con `--integration` si el servicio tiene tests de integración). Sin esto, la nota máxima es **8,0**.
3. **Seguridad**: correr el skill `security-review-tenant` y resolver qué hallazgos son reales.
4. **Puntuar** con la rúbrica de abajo. Cada línea de la nota lleva el dato que la justifica.
5. **Comparar** con `.claude/AUDIT-LAST.md` y escribir el delta. Si la nota anterior era más alta, explicar qué estaba sobreestimado.
6. Actualizar `AUDIT-LAST.md` y la línea de puntaje de `CLAUDE.md` **solo con la nota medida**.

## Rúbrica (suma 10)

| Área | Peso | Cómo se puntúa |
|---|---|---|
| **Estructura y reglas duras** | 2,5 | Parte de 2,5. −0,5 carpetas extra en `src/` · −0,5 `@Controller` en `core/` · −0,5 imports relativos · −0,5 `any` o `@prisma/client` · −0,25 `eslint-disable` · −0,25 archivos `.bak`/`x`/`x.sh` · −0,25 por controller de negocio con `PrismaService` (máx. −0,5) · −0,25 si `core/` tiene servicios con Prisma directo (−0,5 si son más de 10) |
| **Seguridad y multi-tenancy** | 2,5 | Parte de 2,5. −1,0 por cada hallazgo ALTA real sin resolver · −0,25 por cada MEDIA real (máx. −0,75) · −0,5 si no hay test de aislamiento entre tenants contra DB real |
| **Tests** | 2,0 | Cobertura ≥85 % → 2,0 · ≥75 → 1,6 · ≥60 → 1,2 · ≥40 → 0,8 · menos → 0,4. Cobertura sin medir → máx. 1,0. Sin tests de integración → −0,4. Services sin spec: −0,2 cada 3 (máx. −0,4) |
| **Funcionalidad central** | 1,5 | Flujo principal probado de punta a punta con dependencias reales (Redis, DB) → 1,5 · probado solo con mocks/DB → 0,9 · no conectado → 0,3 |
| **Operación** | 1,5 | 0,2 por cada uno: Dockerfile, `railway.json`, health controller, validación de env, workflow de CI (máx. 1,0) · +0,25 imagen construida (CI o Docker local) · +0,25 desplegado en staging con smoke test OK |

## Topes (se aplican después de sumar)
- Hay un hallazgo ALTA de seguridad sin resolver → **máx. 7,0**.
- `verify` en rojo → **máx. 6,0**.
- No se corrió `verify` en esta sesión → **máx. 8,0**.
- Cobertura o notas de fecha anterior reutilizadas sin remedir → no se pueden citar como evidencia.

## Formato de salida
```
Servicio: chatia-backend            Nota: 7,1 / 10   (anterior: 7,3 · 2026-10-15)
Estructura 1,75/2,5   [carpetas extra: 0 · controllers en core: 0 · Prisma en core: 19 archivos]
Seguridad  2,25/2,5   [ALTA: 0 · MEDIA reales: 1]
Tests      1,20/2,0   [cobertura 78 % medida el 2026-10-15 · 9 services sin spec]
Funcional  0,90/1,5   [auto-reply probado con DB, sin Redis]
Operación  1,00/1,5   [5 artefactos · imagen sin construir · sin staging]
Topes aplicados: ninguno
Para subir: smoke test con Redis (+0,6), imagen construida (+0,25), staging OK (+0,25) …
```
Siempre cerrar con **qué haría subir la nota y cuánto**, ordenado por impacto.

## Reglas
- Una nota se defiende con un comando. Si no hay comando, no hay nota para esa línea.
- No redondear hacia arriba. No sumar puntos por "intención" o por algo documentado pero no hecho.
- Los otros servicios se auditan con la misma rúbrica para que las notas sean comparables.
- Si el usuario pide "una nota rápida", igual correr `metrics.js` y decir qué pasos de la rúbrica no se midieron.
