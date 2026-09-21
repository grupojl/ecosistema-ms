# Módulo: campaigns — marketing-backend

## Responsabilidad
Campañas publicitarias con métricas diarias y reglas de automatización.

## Flujo de sync
```
CronJob (cada 15 min)
  → SyncMetricsProcessor recibe job campaign-sync
  → Para cada AdAccount activo de la org:
      adapter.getCampaignMetrics(externalId, yesterday)
      → upsert DailyMetric (campaignId + date como unique)
  → Calcula roas = revenue / spend al insertar
```

## Flujo de automatización
```
CronJob (cada hora)
  → AutomationCheckProcessor recibe job check-automation-rules
  → Para cada AutomationRule activa:
      evalúa condition sobre últimos windowDays de DailyMetric
      si condición cumplida → ejecuta action via adapter
      → registra lastRunAt en AutomationRule
```

## Invariantes
- `roas` se calcula al insertar DailyMetric, nunca on-the-fly en queries
- Una AutomationRule no corre más de 1 vez por windowDays (lastRunAt guard)
- Solo se evalúan reglas sobre campañas con status ACTIVE

## Estado actual
⏳ Pendiente implementación
