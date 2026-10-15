# Pilares de auditoría — chatia-backend

> Qué mirar para auditar chatia-backend de punta a punta. La rúbrica de `skills/audit-service` mide bien el código
> (pilares 1–4, en parte); los pilares 5–8 **hoy no se miden** y hay que sumarlos para que la nota diga algo del producto.
> Nota medida con la rúbrica actual: ver `.claude/AUDIT-LAST.md`.

## Resumen

| # | Pilar | Qué responde | Cobertura hoy | Peso orientativo |
|---|---|---|---|---|
| 1 | Seguridad y aislamiento entre tenants | ¿Un tenant puede ver o tocar datos de otro? | Parcial | 20 % |
| 2 | Flujo central y resiliencia | ¿El mensaje entra, se responde y se envía aunque algo falle? | Parcial | 15 % |
| 3 | Tests y cobertura | ¿Los tests detectan regresiones reales? | Parcial | 5 % |
| 4 | Arquitectura y mantenibilidad | ¿Se puede cambiar sin romper? | Parcial | 5 % |
| 5 | Calidad de la IA | ¿Las respuestas son correctas y útiles? | **No medido** | 20 % |
| 6 | Costo y rendimiento | ¿Cuánto cuesta y cuánto aguanta? | **No medido** | 10 % |
| 7 | Privacidad y datos | ¿Se cuidan los datos de las personas? | **No medido** | 10 % |
| 8 | Operación y recuperación | ¿Se puede desplegar, vigilar y recuperar? | Solo por existencia de archivos | 15 % |

## 1. Seguridad y aislamiento entre tenants
- **Mirar:** guards en todas las rutas; identidad (`organizationId`, `ecosystemId`, rol) solo desde el token; firma HMAC de webhooks sobre el cuerpo crudo; secretos cifrados en reposo y nunca devueltos; SSRF en descargas de URLs externas; WebSocket autenticado; límites del widget público.
- **Medir:** `node .claude/skills/security-review-tenant/scripts/scan.js chatia-backend` (marca, no prueba) + tests de aislamiento con dos tenants contra Postgres real (`src/infrastructure/testing/integration/`).
- **Estado (2026-10-15):** escáner 0 ALTA / 0 MEDIA. Los 20 MEDIA se revisaron a mano: 1 real (corregido: `updateMany` del processor de salida sin organización) y 19 falsos positivos; el escáner ahora resuelve filtros armados en variables (`where`/`scope`) y limpiezas por `cutoff`. Pruebas de ataque por HTTP: `attack-surface.integration.spec.ts` (30 casos: firma ausente/alterada/malformada, secreto de otra cuenta, replay, inyecciones en la ruta, cuerpo enorme, token de widget falsificado o de otro tenant, origen no permitido, rate limit, 409 por slug repetido). Hallazgos corregidos: rechazos de webhook ahora uniformes (antes el texto del error permitía saber qué cuentas existen) y el 404 del widget ya no refleja el slug. RLS evaluado: ADR-023 (no se adopta aún).
- **Hueco:** sin prueba de intrusión externa/manual; RLS pendiente de DT-015.

## 2. Flujo central y resiliencia
- **Mirar:** entrante → cola → asistente → cola de salida → canal → estado en DB; idempotencia (webhook reenviado, job reintentado); reintentos y DLQ; circuit breaker y fallback de proveedores; qué pasa con Redis o Postgres caídos.
- **Medir:** `queues-redis.integration.spec.ts` y `auto-reply.integration.spec.ts` (Postgres + Redis reales, con `TEST_DATABASE_URL` y `TEST_REDIS_URL`).
- **Regla aprendida:** el `jobId` de BullMQ nunca lleva `:` (usar `_`); un mock de la cola no lo detecta.
- **Estado (2026-10-15):** circuito completo con Postgres + Redis + BullMQ reales; 40 entregas concurrentes del mismo mensaje → 1 entrante, 1 respuesta, 1 envío; canal con 500 → FAILED tras los reintentos; LLM real (Groq) probado con `TEST_LLM_LIVE=1` (`llm-live.integration.spec.ts`: respeta el system prompt, JSON, clave inválida falla rápido sin filtrarse). **Bug hallado:** con Redis caído `queue.add` de BullMQ se cuelga indefinidamente → ahora `addWithTimeout` responde 503 a los 3 s (webhooks, envío manual, respuesta automática, ingesta).
- **Hueco:** el sandbox de Meta no se probó (hacen falta credenciales de prueba de una app de Meta); el canal sigue simulado.

## 3. Tests y cobertura
- **Mirar:** cobertura, tests de integración, contratos gRPC, services sin spec.
- **Medir:** `node .claude/skills/verify/scripts/verify.js chatia-backend --integration`.
- **Estado (2026-10-15):** cobertura 94,3 % stmts / 85,7 % branches / 86,0 % funcs; 867 unitarios + 81 de integración; 0 services sin spec; umbrales de `jest.config.ts` subidos a 93/85/85/93. Mutation testing (Stryker, `pnpm test:mutation`, lento, no va en CI) sobre 7 archivos críticos: **66,97 % → 96,55 %** (una corrida completa, 2026-10-15). Sobrevivientes restantes: textos de log y constantes estáticas del módulo (el runner de Jest no las mata) y mutantes equivalentes.
- **Hueco:** mutación solo en 7 archivos; extender a `conversations.service`, `tenant-auth.service`, `events.gateway`.

## 4. Arquitectura y mantenibilidad
- **Mirar:** reglas de ADR-022 (`src/` solo con `core/`, `infrastructure/`, `modules/`; sin `@Controller` en `core/`), imports solo con `@/`, sin `any`, sin Prisma directo en `core/`, `TODO` pendientes.
- **Medir:** `node .claude/skills/audit-service/scripts/metrics.js chatia-backend` y `architecture.spec.ts`.
- **Hueco:** mide forma, no acoplamiento real ni complejidad de los services grandes.

## 5. Calidad de la IA — sin medir
- **Mirar:** exactitud, alucinaciones, que use y cite la base de conocimiento, tasa de handoff, comportamiento fuera de tema o ante intentos de manipular el prompt.
- **Cómo medir:** un set fijo de 50–100 preguntas con respuesta esperada por proyecto, corrido en cada cambio de prompt o de modelo; puntuar aciertos, alucinaciones y handoffs indebidos.
- **Pendiente de producto:** hay dos configuraciones de IA (`AiConfig` por canal, heredada, con prompts de inmobiliaria; `AssistantConfig` por proyecto, la que usa la respuesta automática). Decidir cuál queda.

## 6. Costo y rendimiento — sin medir
- **Mirar:** latencia de punta a punta (p50/p95), tokens y costo por conversación, tope por tenant, comportamiento bajo carga, anti-bucle bot↔bot.
- **Cómo medir:** prueba de carga (k6 o similar) y contadores de tokens por tenant.

## 7. Privacidad y datos — sin medir
- **Mirar:** datos personales en logs, retención y borrado (hay un job de retención), derecho de supresión, qué datos viajan al proveedor del LLM, cifrado en tránsito y en reposo.
- **Cómo medir:** revisar logs reales buscando teléfonos y mensajes; test de supresión de punta a punta (`privacy.integration.spec.ts` cubre una parte).

## 8. Operación y recuperación
- **Mirar:** imagen Docker construida, deploy a staging con smoke test de webhook firmado, alertas, runbooks, RTO/RPO, rollback de migraciones, restore de base.
- **Cómo medir:** hechos, no archivos: un deploy real y un restore real. Hoy la rúbrica suma por existencia de Dockerfile, `railway.json`, health, validación de env y CI (ver `skills/deploy-railway`).

## Cómo usar este archivo
1. Correr los comandos de los pilares 1–4 y 8 (ver `skills/audit-service`).
2. Para los pilares 5–7 no hay comando todavía: crear el set de preguntas, la prueba de carga y la revisión de logs antes de puntuarlos.
3. Una línea de la nota se defiende con un comando; si no hay comando, no hay nota para esa línea.
