# analytics-backend — Metricas y eventos del ecosistema

## Que hace en palabras simples

Registra todo lo que pasa en el negocio: cuantas conversaciones se abrieron,
cuanto tarda el agente en responder, cuantos mensajes envio cada canal.
Y lo muestra en tiempo real en el dashboard sin que el usuario tenga que
recargar la pagina.

## A quien le sirve

Al dueno del negocio que quiere ver como va su equipo de atencion.
Al administrador que necesita exportar datos para reportes.

## Como llegan los eventos

chatia-backend envia eventos via BullMQ (fire-and-forget):
- `conversation.created` cuando llega un mensaje nuevo
- `conversation.resolved` cuando se cierra
- `message.sent` por cada mensaje enviado

El analytics-backend los consume, los persiste, y los publica en tiempo real.

## El dashboard en tiempo real (SSE)

El dashboard de welver abre una conexion SSE (`GET /analytics/live`).
Cuando llega un evento nuevo → el backend lo publica en Redis pub/sub →
todos los pods lo reciben → lo envian al cliente conectado.
El usuario ve los numeros actualizarse sin recargar.

## Las proyecciones nocturnas

Cada hora, el sistema recalcula los resumenes de los ultimos 2 dias
(`DailyConversationSummary`) para que las queries del dashboard sean rapidas.
Un lock distribuido en Redis garantiza que solo un pod corra el calculo a la vez.

## Estado actual

OK — eventos, SSE y proyecciones funcionales.
Export async a workers-backend disponible.
Sin chunking para exports muy grandes (>100MB limitado).
