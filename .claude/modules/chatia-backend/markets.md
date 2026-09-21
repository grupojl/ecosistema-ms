# Markets en chatia-backend

## Rol

El agente de chat IA recibe el contexto de país del cliente para:
- Adaptar las respuestas al contexto local (ej: "enviamos desde Bogotá" en CO)
- Registrar el país en cada conversación para analytics
- Seleccionar templates de respuesta localizados (si existen)

## Cómo llega el contexto

Header `X-Market-Country: CO` en cada request de conversación.
Extraído en el TenantGuard extendido o en el ConversationController.

## Cambios necesarios

### En TenantContext (packages/auth-server)

```typescript
// types/tenant-context.ts — agregar campo opcional
export interface TenantContext {
  organizationId: string
  ecosystemId:    string
  userId:         string
  role:           Role
  marketCountry?: string   // NUEVO — ISO 3166-1 alpha-2, opcional
}
```

### En ConversationService

```typescript
// Al crear/actualizar conversación
await this.repo.saveConversation({
  ...existingFields,
  marketCountry: tenantContext.marketCountry ?? null,
})
```

### En el agente IA

Incluir `marketCountry` en el system prompt cuando esté disponible:

```typescript
const systemPrompt = marketCountry
  ? `${basePrompt}\n\nContexto geográfico del cliente: ${marketCountry}.
     Adapta las respuestas de logística y envíos a este país.`
  : basePrompt
```

## Checklist

- [ ] MKT-CH-01: Agregar `marketCountry?` a `TenantContext`
- [ ] MKT-CH-02: Extraer `X-Market-Country` en el guard/middleware
- [ ] MKT-CH-03: Guardar `marketCountry` en Conversation model (Prisma migration)
- [ ] MKT-CH-04: Inyectar en system prompt del agente
- [ ] MKT-CH-05: Dimensión `market_country` en eventos de analytics
