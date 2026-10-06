# Domain — Ecosistema MS

## Qué es esta carpeta

La fuente de verdad de **qué hace el sistema para cada ecosistema**.
No es documentación técnica — es el contrato de producto.

Cuando implementés una feature nueva en cualquier módulo de un ecosistema,
leés el archivo de ese ecosistema primero. El código implementa lo que dice
el dominio. Si hay contradicción entre el código y este archivo, el dominio gana.

## Archivos

| Archivo | Ecosistema | Estado |
|---------|-----------|--------|
| `welver.md` | Welver | ✅ Activo en producción |
| `manzana.md` | Manzana | 🔲 En desarrollo |
| `mexus.md` | Mexus | 🔲 En desarrollo |

## Regla de mantenimiento

Cualquier cambio en `modules/{ecosistema}/`, `{ecosistema}.strategy.ts` o
`{ecosistema}.config.ts` que modifique comportamiento de producto requiere
actualizar el archivo de dominio correspondiente en el mismo commit.

Sin actualización de dominio → el PR no se aprueba.

## Cómo leer estos archivos

Cada archivo tiene la misma estructura:
1. **Qué es** — el negocio en una línea
2. **Usuario final** — quién chatea, qué espera, qué tono
3. **Organización (tenant)** — quién usa el dashboard, qué mide
4. **Flujo de conversación** — estados y transiciones esperadas
5. **Reglas de negocio** — qué puede y no puede hacer el sistema
6. **Invariantes** — lo que si ocurre es un bug de producto
7. **KPIs** — cómo se mide que el sistema funciona bien

