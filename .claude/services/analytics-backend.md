# analytics-backend — Servicio de Analíticas

## Rol
Persistencia de eventos de analítica, proyecciones agregadas,
SSE (Server-Sent Events) para dashboards en tiempo real, exportación.

## Puertos
- HTTP interno/público: 3003
- gRPC interno: 5004

## Clasificación de carpetas

### 🔴 BLOQUEANTES

| Carpeta | Razón |
|---------|-------|
| `src/prisma/` | Infraestructura core |
| `src/grpc/` | Entry point gRPC |
| `src/health/` | Railway healthcheck |
| `src/analytics/sse/` | SSE es la interfaz de tiempo real — no cambiar el endpoint sin coordinar con los consumers |
| `src/analytics/processors/` | Procesador de eventos — cambiar cómo se procesan afecta toda la analítica |

### 🟢 DINÁMICAS

| Carpeta | Estado |
|---------|--------|
| `src/analytics/` (overview, conversaciones, agentes) | Projections como value objects — Domain/Repository pendiente |
| `src/analytics/projections/` | Lógica de agregación — candidato a value objects de dominio |

## Nota sobre Domain en analytics

Las "entidades" de analytics son eventos + proyecciones.
Los eventos son inmutables (no tienen identidad mutable).
Las proyecciones son value objects derivados.
El patrón Domain/Repository aplica de forma más ligera que en chatia/pagos.
