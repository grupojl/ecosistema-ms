# Norte de marketing-backend — Referentes y decisiones derivadas

> Antes de implementar cualquier feature de marketing-backend, leer este archivo.
> Cada decisión de producto y técnica tiene un "por qué" acá.
> Lo que está decidido acá no se redefine desde cero — se extiende con ADRs.

---

## Los 3 referentes

```
Triple Whale    →  atribución multi-touch, ROAS en tiempo real por campaña/ad set/ad
                   dashboard unificado que consolida Meta + Google + TikTok en una vista
                   "Pixel" propio para tracking server-side (cookieless)
                   alertas automáticas cuando ROAS cae por debajo del umbral

Motion          →  creative analytics: qué creativos (imágenes/videos) generan mejor CTR
                   velocidad de fatiga de un creativo en el tiempo
                   recomendaciones de cuándo rotar o pausar un creativo
                   interfaz pensada para que un no-técnico tome decisiones en segundos

Northbeam       →  MTA (multi-touch attribution) con modelado estadístico bayesiano
                   separación entre "revenue atribuido" y "revenue real" — honestidad sobre
                   la incertidumbre de la atribución
                   blended ROAS vs channel ROAS — la diferencia importa para presupuesto
```

---

## Qué aprendemos de cada referente y cómo se aplica

### De Triple Whale — la fuente unificada de verdad

**Qué hacen bien:**
Un operador de ecommerce tiene Meta Ads Manager, Google Ads y TikTok Ads abiertos
en 3 tabs distintas. Triple Whale los consolida en una sola vista con la misma
moneda de medición. El ROAS que ven en Meta no es el mismo que el ROAS real porque
Meta se auto-atribuye conversiones. Triple Whale corrige eso.

**Decisiones que tomamos:**

1. **Un AdAccount por plataforma, un dashboard unificado.**
   El frontend de marketing nunca abre iframes de Meta/Google/TikTok.
   Todos los datos pasan por `marketing-backend` y se muestran con el mismo formato.

2. **ROAS calculado por nosotros, no por la plataforma.**
   `DailyMetric.roas = revenue / spend` se calcula al insertar, usando el `revenue`
   que viene de `pasarelapagos-backend` (source of truth real), no el revenue
   que reporta Meta (que incluye view-through attribution inflado).
   Esta es la diferencia entre ROAS honesto y ROAS de plataforma.

3. **Alertas proactivas obligatorias.**
   Si ROAS < 1.0 por 2 días consecutivos → alerta automática via `notificaciones-backend`.
   El usuario no tiene que abrir el dashboard para enterarse que está perdiendo dinero.
   Esto va en `AutomationCheckProcessor` como regla de sistema (no configurable en v1).

4. **Sync cada 15 minutos, no tiempo real.**
   Las APIs de Meta/Google/TikTok tienen rate limits. 15 minutos es el balance
   entre frescura de datos y costo de API calls. Configurable por ecosistema
   vía `MARKETING_SYNC_INTERVAL_MINUTES`.

---

### De Motion — las decisiones las toma alguien que no es ingeniero

**Qué hacen bien:**
Motion está diseñado para que un founder o un media buyer, no un data analyst,
pueda ver qué creativos están funcionando y tomar acción en menos de 30 segundos.
La interfaz prioriza velocidad de decisión sobre completitud de datos.

**Decisiones que tomamos:**

1. **La UI de campañas muestra máximo 5 métricas visibles por defecto.**
   ROAS, Spend, Conversiones, CTR, CPC. Nada más en la vista principal.
   Los datos crudos (impressiones, frecuencia, CPM) van en un "ver detalle" secundario.
   Un dashboard con 20 columnas no es un dashboard — es una hoja de cálculo.

2. **Automatización expresada en lenguaje humano, no en código.**
   La regla `{ metric: 'roas', operator: 'lt', value: 1.5, windowDays: 3 }` se muestra
   en la UI como: *"Si el ROAS está por debajo de 1.5 durante 3 días seguidos → Pausar campaña"*.
   El JSON es el contrato interno. El usuario nunca ve el JSON.

3. **Acciones con confirmación, no silenciosas.**
   Cuando `AutomationCheckProcessor` ejecuta una acción (pausa, escala de presupuesto),
   notifica al usuario via `notificaciones-backend` DESPUÉS de ejecutar.
   El log de acciones automáticas es visible en el frontend — mismo principio que
   el audit trail del superadmin.

4. **Fatiga de creativo — Fase 2.**
   Motion trackea cuándo un creativo empieza a perder CTR (señal de fatiga).
   En v1 no lo implementamos — requiere granularidad a nivel `ad` (no `campaign`).
   El schema ya lo permite: `DailyMetric` puede tener `adId` además de `campaignId`.
   Documentado como Fase 2 para no olvidar el diseño.

---

### De Northbeam — honestidad sobre la incertidumbre

**Qué hacen bien:**
Northbeam no dice "esta venta fue de Meta". Dice "estimamos que el 60% de esta
venta tiene origen en Meta, con un intervalo de confianza de ±15%". Esa honestidad
es lo que hace que los media buyers confíen en el sistema. Un sistema que siempre
atribuye con certeza 100% está mintiendo.

**Decisiones que tomamos:**

1. **Atribución v1 = last-click, documentado explícitamente como limitación.**
   `AttributionEvent` registra la campaña activa más reciente de la org.
   No es MTA. No es probabilístico. Es last-click simple.
   Esto se documenta en la UI: *"Atribución por último clic — ver limitaciones"*.
   No mentimos al usuario diciendo que tenemos MTA cuando no lo tenemos.

2. **Blended ROAS vs Channel ROAS — ambos visibles.**
   `MetricsSummaryResponse` expone:
   - `roas` → blended: revenue total / spend total (todos los canales)
   - `byPlatform[].roas` → channel ROAS por plataforma
   La diferencia entre ambos revela cuánto se están solapando las atribuciones.
   Si blended ROAS es 2.5 pero la suma de channel ROAS da 4.0 → hay overlap.

3. **`AttributionEvent.campaignId` es nullable.**
   Si no se puede atribuir una conversión a ninguna campaña activa, se registra
   igual con `campaignId: null`. Esos eventos van al "revenue no atribuido".
   Un sistema que siempre fuerza atribución está inflando los números.

4. **Multi-touch attribution — Fase 3.**
   Requiere pixel tracking propio (server-side events), fingerprinting de sesión
   y modelado estadístico. No está en el roadmap hasta que v1 tenga cobertura real.

---

## Qué NO hacemos (aunque los referentes lo hacen)

| Feature | Referente que lo tiene | Por qué no en v1 |
|---------|----------------------|------------------|
| Pixel propio (server-side tracking) | Triple Whale | Requiere snippet en cada storefront — complejidad de deploy |
| Creative analytics (imágenes/videos) | Motion | Requiere integración con el asset store de Meta/Google |
| MTA estadístico | Northbeam | Requiere 6+ meses de data histórica para calibrar el modelo |
| Lookalike audience builder | Triple Whale | Requiere acceso a datos de usuarios — privacidad primero |
| Reglas de automatización con IA | Motion | Fase 4 — primero las reglas manuales tienen que funcionar bien |

---

## Métricas que importan (y cuáles son ruido)

### Las 5 que importan siempre
| Métrica | Fórmula | Por qué importa |
|---------|---------|-----------------|
| ROAS | revenue / spend | Si < 1.0 estás perdiendo dinero |
| CPA | spend / conversions | Costo por adquisición — se compara vs LTV |
| CTR | clicks / impressions | Señal de calidad del creativo |
| CPC | spend / clicks | Eficiencia del tráfico |
| Frecuencia | impressions / reach | Fatiga de audiencia — sube → rendimiento baja |

### Las que son ruido en v1
- Impressions solas (sin contexto de reach o CTR)
- Clicks sin conversión (tráfico que no convierte)
- CPM sin CTR (el alcance barato que nadie ve)

---

## Regla de oro para nuevas features

> ¿Esta feature ayuda a alguien a gastar menos dinero en ads que no funcionan
> o a gastar más en los que sí funcionan?
> Si la respuesta no es un "sí" claro → no pertenece a marketing-backend v1.

---

## Referencias

- `services/marketing-backend.md` — ficha técnica completa
- `modules/marketing-backend/campaigns.md` — flujo de automatización
- `modules/marketing-backend/attribution.md` — limitaciones de atribución v1
- `contracts/bullmq-queues.md` — queues de marketing
- `decisions/ADR-008-marketing-norte.md` — cuando se escriba el ADR formal
