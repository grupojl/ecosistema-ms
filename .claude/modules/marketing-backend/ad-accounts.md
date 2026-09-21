# Módulo: ad-accounts — marketing-backend

## Responsabilidad
Gestión de cuentas publicitarias conectadas por organización.
Un AdAccount = una cuenta en Meta/Google/TikTok vinculada a una org.

## Adapter pattern
Cada plataforma implementa `AdPlatformInterface`:
```typescript
interface AdPlatformInterface {
  syncCampaigns(accountId: string): Promise<CampaignSyncResult[]>;
  getCampaignMetrics(externalId: string, dateRange: DateRange): Promise<DailyMetricData[]>;
  pauseCampaign(externalId: string): Promise<void>;
  scaleBudget(externalId: string, factor: number): Promise<void>;
}
```

## Seguridad
- `accessToken` → cifrado con PII service antes de persistir en DB
- NUNCA retornar `accessToken` en responses REST
- Rotación de tokens: endpoint `POST /ad-accounts/:id/refresh-token`

## Estado actual
⏳ Pendiente implementación
