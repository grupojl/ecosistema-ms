# workers-backend — Motor de jobs del ecosistema

## Que hace en palabras simples

Es el "backstage" que hace el trabajo pesado. Mientras el usuario sigue
usando el sistema sin esperar, este servicio:
- Indexa documentos para la base de conocimiento de la IA
- Envia emails masivos de campanas
- Genera reportes de analytics en segundo plano
- Lleva el registro de todos los trabajos para poder auditarlos

## A quien le sirve

No tiene usuarios directos. Otros microservicios le delegan trabajo:
- chatia-backend le pide que indexe documentos
- analytics-backend le pide que genere exports
- El scheduler interno lanza campanas programadas

## Como funciona

Cada tipo de trabajo tiene su propia cola (queue) y su propio procesador:

| Que hace | Queue | Lo pide |
|---------|-------|---------|
| Indexar documento en KB | `vector-index` | chatia-backend |
| Ingerir FAQ en KB | `faq-ingest` | chatia-backend |
| Enviar campana de email | `campaign-email` | scheduler interno |
| Generar export de analytics | `analytics-export` | analytics-backend |

## Trazabilidad

Cada job queda registrado en `JobLog` con su estado, duracion y resultado.
Desde el dashboard de workers se puede ver el estado de cualquier job
y volver a intentar los que fallaron.

## Las campanas programadas

El sistema revisa cada minuto si hay campanas con fecha de envio pasada
y las despacha automaticamente. Solo una instancia puede hacer esto a la vez
(lock distribuido en Redis).

## Estado actual

OK — todos los processors funcionan.
CRITICO: campanas de email sin destinatarios reales (DT-003).
Lock de scheduler simplificado — no es Redlock real (DT-005).
