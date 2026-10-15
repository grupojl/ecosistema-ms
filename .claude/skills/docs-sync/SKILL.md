---
name: docs-sync
description: Mantener la documentación de .claude alineada con el código — detecta rutas/archivos citados en los .md que ya no existen y reglas que se contradicen entre documentos. Usar después de mover carpetas, renombrar módulos o cambiar una regla de arquitectura; antes de actualizar AUDIT-LAST.md; y cuando el usuario diga "actualizá la documentación" o "el .claude está desactualizado".
---

# docs-sync — la documentación no puede contradecir al código

`.claude` es lo que se lee para decidir cómo escribir código. Si miente, genera código equivocado.

## Procedimiento
1. **Detectar**:
   ```bash
   node .claude/skills/docs-sync/scripts/check-paths.js                         # todos los servicios
   node .claude/skills/docs-sync/scripts/check-paths.js --service chatia-backend
   ```
   Lista cada referencia entre `backticks` a una ruta que ya no existe. Sale con código 1 si hay alguna.
2. **Clasificar** cada hallazgo:
   - **Obsoleta por mudanza** → corregir la ruta (`src/queue/` → `src/infrastructure/queue/`).
   - **Histórica a propósito** (un ADR, una nota de lo que se hizo) → dejarla, o marcarla con `antes:`/`legacy`, que el script ignora.
   - **Aspiracional** (cita algo que nunca se creó) → borrarla o convertirla en tarea en `roadmap/deuda-tecnica.md`.
3. **Buscar contradicciones de reglas**: cada vez que cambia una regla, buscar su texto viejo:
   ```bash
   grep -rn "controller" .claude/architecture .claude/checklists | head
   ```
   Fuentes de verdad, en orden: `architecture/01-capas-microservicio.md` (estructura) → `architecture/03-reglas-duras.md` → ADRs → checklists.
   Los checklists y `services/*.md` se alinean a las dos primeras, no al revés.
4. Si el cambio es una **decisión nueva**, no editar un ADR viejo: crear el siguiente (`decisions/ADR-0NN-…md`) y enlazarlo.
5. Volver a correr el script hasta que dé verde, o hasta que todo lo que quede esté clasificado como histórico.

## Qué ignora el script
- La carpeta `decisions/` (los ADR son historia), `skills/` y `tools/`.
- Rutas con placeholders (`{servicio}`, `<x>`), comodines (`*`) o `...`.
- Líneas que contienen ❌, "incorrecto", "antes:", "era:", "legacy" o "deprecated".
- Los `src/...` de documentos que no pertenecen a un servicio concreto (solo se resuelven en `services/<svc>.md` y `modules/<svc>/`).

## Cuándo correrlo
- Después de cualquier mudanza de carpetas (obligatorio) — la herramienta `tools/restructure-src.js` no toca los `.md`.
- Antes de cerrar una auditoría (`audit-service`) y antes de un PR que cambie `.claude`.
- Los otros 5 servicios **todavía no** cumplen ADR-022; sus documentos describen su estructura real, no la objetivo. No "corregirlos" hasta migrarlos.

## Regla
No inventar rutas para que el script dé verde: si el documento cita algo que no existe, o se crea (si debía existir) o se quita la cita.
