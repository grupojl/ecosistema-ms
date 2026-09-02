# Fase 4 — Escala
## Escalones 9, 11, 12, 13 — 3 ecosistemas simultáneos

**Estado:** ⚪ Pendiente — iniciar cuando Fase 3 esté completa
**Cuándo:** Cuando welver, manzana y mexus operan simultáneamente con tráfico real
**Referentes:** AWS (DR) · Linear/Figma (UX) · Netflix (Chaos) · Airbnb/Uber (FinOps)

---

## Escalón 9 — Recuperación ante Desastres

### Qué significa para ecosistema-ms

Si Railway cae, si una DB se corrompe, si un servicio queda en estado inconsistente —
cuánto tiempo tarda en recuperarse (RTO) y cuántos datos se pierden como máximo (RPO).

### Qué hay que hacer

1. **Definir RTO y RPO por servicio** — antes de que ocurra el desastre:
   | Servicio | RTO objetivo | RPO objetivo |
   |---|---|---|
   | chatia-backend | < 5 min | < 1 min (BullMQ persistent) |
   | pasarelapagos-backend | < 2 min | 0 (transacciones financieras) |
   | notificaciones-backend | < 10 min | < 5 min |
   | analytics-backend | < 15 min | < 1 hora (datos analíticos) |
   | workers-backend | < 10 min | < 5 min (jobs reintentables) |

2. **Backups automáticos verificados** — confirmar que Railway PostgreSQL
   hace backups y probar una restauración real. Un backup que nunca se probó
   no existe.

3. **Estado de BullMQ en Redis persistente** — confirmar que Redis tiene
   `appendonly yes` (AOF) para que los jobs no se pierdan si Redis reinicia.

4. **Runbook de recuperación por escenario** — documentar paso a paso:
   - "La DB de chatia-backend se corrompió" → qué hacer
   - "Railway está caído" → qué hacer
   - "Un servicio quedó en loop de crash" → qué hacer

5. **Drill de recuperación** — al menos una vez antes de escalar a 3
   ecosistemas: simular la caída de un servicio y medir el RTO real.

### Cómo saber que este escalón está completo

- RTO y RPO definidos y documentados por servicio
- Restauración de backup probada exitosamente en staging
- Runbooks de recuperación escritos para los 3 escenarios más probables
- Redis con persistencia AOF confirmada

---

## Escalón 11 — Rendimiento Percibido y UX (Latency-Zero)

### Qué significa para ecosistema-ms

Los consumidores de ecosistema-ms (los frontends de welver, manzana, mexus)
deben percibir respuestas en menos de 100ms para operaciones comunes.

### Qué hay que hacer

1. **Medir latencias actuales por endpoint** — antes de optimizar, medir.
   Agregar `p50`, `p95`, `p99` de latencia en las métricas de Prometheus.

2. **Caché de respuestas frecuentes** — las respuestas de configuración de
   agente, FAQ más consultadas, y preferencias de notificación son candidatas
   a caché con TTL corto.

3. **Paginación en todos los listados** — `conversations/list`, `contacts/list`,
   `messages/list` — ningún endpoint devuelve un array sin límite.
   Sin paginación, el primer cliente con 10.000 conversaciones rompe la API.

4. **Índices de DB optimizados** — medir las queries más lentas con
   `EXPLAIN ANALYZE` en PostgreSQL. Un query sin índice que tarda 2ms
   con 100 registros tarda 2 segundos con 100.000.

5. **gRPC streaming para chat** — el chat en tiempo real no debería ser
   polling. Si hoy es polling, evaluar gRPC server streaming para mensajes.

6. **Optimistic updates en los frontends** — los frontends de los ecosistemas
   deben actualizar la UI antes de recibir confirmación del back para
   operaciones de baja criticidad (marcar mensaje como leído, etc.).

### Cómo saber que este escalón está completo

- `p95` de latencia < 100ms en endpoints principales con carga simulada
- Todos los listados tienen paginación (`limit` + `cursor` o `page`)
- Métricas de latencia visibles en dashboard

---

## Escalón 12 — Alta Disponibilidad Global y Chaos Engineering

### Qué significa para ecosistema-ms

El sistema sigue funcionando cuando un servicio cae, cuando Railway tiene
un incidente parcial, o cuando una queue se satura.

### Qué hay que hacer

1. **Múltiples réplicas en Railway** — configurar al menos 2 réplicas de
   `chatia-backend` y `pasarelapagos-backend` en Railway. Si una réplica
   muere, la otra sigue sirviendo.

2. **Circuit breaker distribuido activo** — cuando `analytics-backend` está
   caído, `chatia-backend` no debe fallar — debe degradarse (skip analytics)
   y continuar. El circuit breaker en Redis gestiona esto.

3. **Health checks con degradación** — el `/health` debe distinguir entre:
   - `status: "ok"` — todo funciona
   - `status: "degraded"` — funciona pero con dependencias caídas
   - `status: "down"` — no puede servir requests

4. **Chaos Engineering básico** — antes del 1% mundial, hacer:
   - Apagar manualmente `analytics-backend` → verificar que chatia sigue funcionando
   - Saturar la queue de workers → verificar que chatia no se degrada
   - Cortar Redis → verificar fallback a MemoryCache

5. **Documentar los resultados del chaos** — qué se rompió, qué no se rompió,
   qué se arregló. Eso es el Chaos Engineering real.

### Cómo saber que este escalón está completo

- 2+ réplicas de servicios críticos en Railway
- Chaos drill documentado con resultados
- Circuit breaker distribuido (Redis) activo y probado
- Health check con tres estados implementado

---

## Escalón 13 — Eficiencia Financiera (FinOps)

### Qué significa para ecosistema-ms

Saber exactamente cuánto cuesta servir a cada ecosistema, escalar solo
lo que necesita escalar, y predecir el costo de agregar un ecosistema nuevo.

### Qué hay que hacer

1. **Costo por ecosistema** — poder responder: "¿cuánto nos cuesta mensualmente
   servir a welver?" Railway expone métricas de consumo por servicio.
   Con `ecosystemId` en los logs, se puede aproximar el costo por cliente.

2. **Escalado automático** — Railway puede escalar réplicas según CPU/memoria.
   Configurar: escalar hacia arriba cuando CPU > 70%, escalar hacia abajo
   cuando CPU < 20% por más de 5 minutos.

3. **Costo marginal por ecosistema nuevo** — antes de incorporar el cuarto
   ecosistema, calcular: ¿cuánto recursos adicionales consume?
   La respuesta debe ser predecible, no una sorpresa.

4. **Optimizar workers-backend** — los jobs de campaña son la operación más
   cara en términos de CPU/tiempo. Medir costo por campaña procesada y
   optimizar el throughput del worker.

5. **TTL de caché como palanca de costo** — un TTL más largo en Redis reduce
   queries a DB y reduce costo de cómputo. Un TTL más corto da datos más
   frescos pero cuesta más. Documentar la decisión por tipo de dato.

### Cómo saber que este escalón está completo

- Dashboard de costos con breakdown por servicio (Railway)
- Escalado automático configurado en servicios con carga variable
- Costo estimado de un nuevo ecosistema documentado antes de incorporarlo
