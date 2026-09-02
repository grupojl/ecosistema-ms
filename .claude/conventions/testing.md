# Testing

## Stack

- Backend: Jest + Supertest
- Cobertura mínima: 85% en paths críticos (pendiente — no hay tests actualmente)

## Reglas duras

- Un test de domain (cuando exista la capa domain) nunca importa `@nestjs/*`
  ni `@prisma/client` — se testea sin mockear nada.
- Cada módulo nuevo incluye: unit tests de la lógica de dominio + integration
  test del contrato HTTP REST + integration test del contrato gRPC.

## Estado actual

No hay evidencia de tests en el packing. Prioridad baja hasta que:
1. La Capa 2 (DTOs → Zod) esté migrada
2. La Capa 4+5 (Domain/Repository) esté iniciada con el MOLDE VIVO

Testear services acoplados a Prisma es costoso y frágil.
Testear domain puro y repositories con mock es barato y robusto.

## Orden de implementación

1. Crear domain de `conversations/` (chatia-backend) y `payments/` (pagos-backend)
2. Tests de domain primero (sin NestJS, sin Prisma)
3. Tests de repository (mock Prisma con `@prisma/client/testing`)
4. Integration tests de controllers REST (Supertest)
5. Integration tests de controllers gRPC
