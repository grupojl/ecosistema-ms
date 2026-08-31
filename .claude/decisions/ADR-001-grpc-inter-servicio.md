# ADR-001 — gRPC para comunicación inter-servicio

**Estado**: Aceptado
**Fecha**: 2024-01

## Contexto
Los microservicios necesitan llamarse entre sí de forma síncrona (ej: chatia llama a
pasarelapagos para verificar saldo, analytics llama a workers para enqueue export).
Necesitamos un mecanismo tipado, eficiente y con contrato versionable.

## Decisión
Usar gRPC con protobuf para todas las llamadas síncronas inter-servicio.
Los contratos viven en `packages/proto/proto/*.proto`.

## Alternativas consideradas
| Opción | Por qué se descartó |
|--------|---------------------|
| HTTP REST inter-servicio | Sin tipado de contrato, overhead de serialización JSON |
| tRPC | Excelente para TS-to-TS pero no estándar para multi-lenguaje futuro |
| GraphQL federation | Demasiado overhead para llamadas internas |

## Consecuencias
- ✅ Contratos versionables y tipados con protobuf
- ✅ Mejor performance que JSON (binario, HTTP/2)
- ✅ Solo disponible en red privada Railway (seguridad)
- ⚠️ Curva de aprendizaje de protobuf
- ⚠️ Requiere cuidado en cambios de proto (no breaking sin deprecation)
