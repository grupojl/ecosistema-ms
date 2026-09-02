# Principios no negociables

## El monorepo es solo herramienta de desarrollo

pnpm workspaces + `catalog:` único existen para compartir tipos y código entre
microservicios **en local**. En producción, **cada servicio se despliega individual
y aisladamente en Railway** vía su propio `Dockerfile` + `railway.json`
(`dockerfilePath` apuntando a esa carpeta).

## Consecuencias de diseño

1. Ningún servicio puede asumir en runtime que los otros viven en el mismo
   filesystem o proceso.
2. Los `packages/*` (`@ecosistema-ms/proto`, `@ecosistema-ms/auth-server`,
   `@ecosistema-ms/grpc-client`) se **copian y buildean dentro de cada imagen
   Docker** — no son un servicio corriendo aparte, son librería compilada al
   momento del build.
3. Toda comunicación entre servicios en producción es **gRPC sobre red privada
   Railway** (para llamadas internas) o **HTTP REST** (para APIs públicas).
   Un `import { ConversationsService } from '../../chatia-backend/...'` sería
   un bug de arquitectura aunque el monorepo lo permita compilar.
4. Variables de entorno (`ARG`/`ENV` en cada Dockerfile) son la única fuente
   de configuración por servicio.

## Regla de oro para toda decisión nueva

> ¿Esto asume que dos microservicios comparten proceso, filesystem o memoria en
> producción? Si la respuesta es sí, está mal. Railway los corre aislados;
> el contrato entre ellos es gRPC + HTTP + env vars, punto.

## Señales de alarma concretas

### 1. Import que cruza la frontera entre microservicios
```ts
// PROHIBIDO
import { ConversationsService } from '../../../chatia-backend/src/conversations/conversations.service';
```
El Dockerfile de cada servicio solo copia su propia carpeta + `packages/`.
Esa ruta no existe en la imagen.

### 2. Llamar un método de servicio en vez de gRPC
```ts
// PROHIBIDO
const result = analyticsService.getOverview(params);

// CORRECTO — cliente gRPC desde packages/grpc-client
const result = await this.analyticsGrpcClient.getOverview(params);
```

### 3. Estado en memoria compartido entre procesos
```ts
// PROHIBIDO para datos cross-request en producción
let cacheGlobal = new Map();
// En prod son procesos Node separados — usar Redis
```

### 4. Rutas relativas en vez de env vars
```ts
// PROHIBIDO
const CHATIA_URL = '../chatia-backend';

// CORRECTO
const CHATIA_GRPC_URL = process.env.CHATIA_GRPC_URL;
// En local: localhost:5001 | En Railway: chatia-backend.railway.internal:5001
```

## Comunicación interna — gRPC sobre red privada

```
✅ Servicio → Servicio (interno):  gRPC (red privada Railway)
✅ Cliente externo → Servicio:     HTTP REST (endpoint público)
✅ Llamada síncrona interna:       gRPC unary RPC
✅ Stream de eventos:              gRPC server streaming o BullMQ

❌ Import directo entre servicios: bug de arquitectura
❌ HTTP interno entre servicios:   aceptable solo si no hay .proto definido aún
                                    (documentar con TODO y crear el .proto)
```

**Variables gRPC por entorno:**
- Local: `CHATIA_GRPC_URL=localhost:5001`
- Railway: `CHATIA_GRPC_URL=chatia-backend.railway.internal:5001`

## Degradación y resiliencia entre servicios

Cada decisión de degradación debe estar documentada aquí antes de llegar a producción.

### Decisiones pendientes (deben resolverse antes de lanzamiento)

- ¿Qué hace `notificaciones-backend` si `chatia-backend` no responde en el DLQ callback?
- ¿Qué timeout tiene `analytics-backend` para persitir eventos? ¿Se descarta o se reintenta?
- ¿Qué hace `workers-backend` si `chatia-backend` gRPC no responde al procesar una campaña?
- ¿Con cuántas réplicas Railway puede escalar cada servicio antes de que el circuit-breaker
  local (en memoria) deje de ser válido? → solución: migrar circuit-breaker a Redis.

## Checklist de 3 preguntas antes de escribir código nuevo

1. ¿Este import sale de mi carpeta de servicio + `packages/`? → Si sí, prohibido.
2. ¿Este dato lo necesito "ya generado por otro servicio"? → Llega por gRPC, no por import.
3. ¿Si Railway escala este servicio a 3 réplicas, esto se rompe? → Si depende de memoria
   compartida entre réplicas, va a Redis.
