# Contrato: Comunicación HTTP inter-servicio

## Principio

La comunicación inter-servicio preferida es gRPC (ver `contracts/grpc-contracts.md`).
HTTP entre microservicios solo está justificado cuando:
1. El .proto no existe aún → documentar con `// TODO(grpc): crear .proto cuando...`
2. El consumidor es externo (cliente JS, mobile, webhook externo)

## Llamadas HTTP actualmente documentadas

| Desde | Hacia | Endpoint | Estado |
|---|---|---|---|
| Externos (clientes) | `chatia-backend` | `POST /conversations`, etc. | REST público |
| Externos (clientes) | `pasarelapagos-backend` | `POST /payments`, etc. | REST público |
| `welver/realsass-ecommerce-back` | Ecosistema-ms services | pendiente de documentar | ⚠️ |

## Regla

Si se agrega una llamada HTTP entre microservicios internos sin .proto,
se agrega el `// TODO(grpc):` comment y se crea el ticket para el .proto.
Sin el comment, la llamada HTTP entre servicios es un bloqueante en PR.
