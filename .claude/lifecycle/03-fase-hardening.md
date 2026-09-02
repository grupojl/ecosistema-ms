# Fase 3 — Hardening
## Escalones 7, 8, 10 — Primer ecosistema en producción

**Estado:** ⚪ Pendiente — iniciar cuando Fase 2 esté completa
**Cuándo:** Cuando el primer ecosistema real (welver) empieza a recibir usuarios
**Referentes:** Snyk/CrowdStrike (seguridad) · Apple (privacidad) · Kafka/Redis (async)

---

## Escalón 7 — Seguridad Defensiva (SecOps)

### Qué significa para ecosistema-ms

Escaneo continuo de vulnerabilidades en dependencias, protección contra
fuerza bruta y abuso de API, protocolos de respuesta a incidentes.

### Qué hay que hacer

1. **Escaneo de dependencias en CI** — agregar `pnpm audit` en el pipeline
   de GitHub Actions. Fallar el build si hay vulnerabilidades críticas o altas.
   Opcionalmente integrar Snyk para alertas automáticas.

2. **Rate limiting por ecosistema** — el endpoint público de chatia-backend
   (widget de chat) puede ser abusado. Limitar por `ecosystemId` + IP:
   ```ts
   // X requests por minuto por ecosystemId
   // X requests por minuto por IP (protección contra DDoS básico)
   ```

3. **API keys rotables para tenants** — `pasarelapagos-backend` tiene
   `api-key.service.ts`. Verificar que las keys pueden rotarse sin downtime
   y que las viejas expiran correctamente.

4. **Protección contra inyección** — Prisma ORM protege contra SQL injection
   por diseño. Verificar que ningún servicio usa `$queryRaw` con interpolación
   de strings sin sanitizar.

5. **Logs de seguridad separados** — autenticaciones fallidas, intentos de
   acceso cross-tenant, rate limit hits — deben loguearse con nivel `warn`/`error`
   y un campo `securityEvent: true` para poder filtrarlos.

6. **Runbook de incidente de seguridad** — qué hacer si se detecta acceso
   no autorizado. Debe existir antes de producción, no después de un incidente.

### Cómo saber que este escalón está completo

- `pnpm audit` en CI — 0 vulnerabilidades críticas o altas
- Rate limiting activo en endpoints públicos de chatia y pagos
- Logs de seguridad filtrables en producción
- Runbook de incidente de seguridad documentado

---

## Escalón 8 — Cumplimiento Legal y Privacidad

### Qué significa para ecosistema-ms

Cifrado de datos sensibles en tránsito y reposo, manejo correcto de PII,
términos de servicio, adherencia a normativas de privacidad (GDPR/LGPD según región).

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| HTTPS (tránsito) | ✅ Railway | TLS automático |
| PII service | ✅ Implementado | `pasarelapagos-backend/src/common/services/pii.service.ts` |
| Cifrado en reposo | ⚠️ Verificar | Railway PostgreSQL — confirmar cifrado a nivel de disco |
| Datos de pago | ⚠️ Parcial | PII service existe — verificar cobertura completa |
| Retención de datos | ❌ No definido | Política de cuánto tiempo se guardan conversaciones, pagos, etc. |
| Derecho al olvido | ❌ No implementado | Proceso para eliminar datos de un usuario a pedido |

### Qué hay que hacer

1. **Auditar cobertura del PII service** — verificar que todos los datos
   de tarjetas, documentos de identidad y datos bancarios pasan por
   `pii.service.ts` antes de persistirse. Ningún dato PII en texto plano en DB.

2. **Política de retención de datos** — definir y documentar:
   - Conversaciones: ¿cuánto tiempo se guardan?
   - Pagos: ¿qué datos se retienen y por cuánto tiempo? (requisito legal)
   - Logs: ¿cuánto tiempo en producción?

3. **Soft-delete como estándar** — conversaciones y contactos ya tienen
   soft-delete en chatia-backend. Verificar que todos los modelos con datos
   de usuarios tienen `deletedAt` y no se eliminan físicamente por defecto.

4. **Endpoint de eliminación de datos** — para cumplir GDPR/LGPD:
   un endpoint que elimine todos los datos de un usuario a pedido.
   Documentar el proceso aunque sea manual al principio.

5. **Separación de datos entre ecosistemas** — confirmar que welver,
   manzana y mexus no pueden acceder a datos del otro. El `ecosystemId`
   en cada query es la garantía técnica — el test de cross-tenant es la prueba.

### Cómo saber que este escalón está completo

- Ningún dato PII en texto plano en ninguna tabla de DB
- Política de retención de datos documentada y configurada
- Proceso de eliminación de datos documentado (aunque sea manual)
- Test de cross-tenant: request de welver no retorna datos de manzana

---

## Escalón 10 — Datos Masivos y Procesamiento Asíncrono

### Qué significa para ecosistema-ms

BullMQ bajo carga real, estrategia de caché coherente, patrones de
lectura/escritura escalables cuando hay múltiples ecosistemas concurrentes.

### Estado actual

| Ítem | Estado | Detalle |
|------|--------|---------|
| BullMQ queues | ✅ Implementado | chatia, notificaciones, workers tienen queues |
| DLQ (Dead Letter Queue) | ✅ Implementado | chatia, notificaciones, workers tienen DLQ |
| Redis caché | ✅ Implementado | `cache.service.ts` en chatia-backend |
| Circuit breaker | ✅ Implementado | `circuit-breaker.service.ts` — pero en memoria |
| Reintentos configurados | ⚠️ Verificar | Confirmar retry policy en cada queue |
| Concurrencia de workers | ⚠️ Verificar | Cuántos jobs simultáneos procesa cada worker |
| Circuit breaker distribuido | ❌ No implementado | Opera en memoria — no funciona con múltiples réplicas |

### Qué hay que hacer

1. **Documentar y verificar retry policy por queue** — cada queue de BullMQ
   debe tener configurado:
   - `attempts`: cuántos reintentos
   - `backoff`: tiempo entre reintentos (exponential recomendado)
   - `removeOnComplete` / `removeOnFail`: política de limpieza

2. **Circuit breaker distribuido** — el `CircuitBreakerService` actual opera
   en memoria. Con más de 1 réplica en Railway, cada réplica tiene su propio
   estado de circuit breaker. Migrar a Redis para estado compartido.

3. **Caché por ecosystemId** — la clave de caché en `cache.service.ts` debe
   incluir `ecosystemId` para evitar que datos de welver cacheen datos de manzana.
   ```ts
   // ❌ Clave sin scope
   cacheKey = `conversation:${conversationId}`
   // ✅ Clave con scope
   cacheKey = `${ecosystemId}:conversation:${conversationId}`
   ```

4. **Monitoreo de queues** — con Bull Board o similar: ver en tiempo real
   cuántos jobs están en cola, cuántos fallaron, cuántos están procesando.
   Antes de producción con 3 ecosistemas, necesitás visibilidad.

5. **Límites de concurrencia** — definir cuántos jobs simultáneos procesa
   `workers-backend` para campañas. Sin límite, una campaña grande de welver
   puede saturar el worker y demorar las campañas de manzana.

6. **Aislamiento de queues por ecosistema** — evaluar si queues separadas
   por ecosistema o prioridad por `ecosystemId` dentro de la misma queue.

### Cómo saber que este escalón está completo

- Retry policy documentada y configurada en todas las queues
- Circuit breaker con estado en Redis (no en memoria)
- Todas las claves de caché incluyen `ecosystemId`
- Dashboard de queues (Bull Board) activo
- Límites de concurrencia documentados y configurados
