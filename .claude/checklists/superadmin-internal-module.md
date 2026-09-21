# Checklist: InternalModule para superadmin — IMPLEMENTADO ✅

**Estado:** Aplicado en chatia, pasarela y workers (sesión 2026-09-19)

## Estructura implementada

```
src/internal/
  internal-api-key.guard.ts   # valida x-internal-api-key header
  internal.controller.ts      # endpoints /internal/*
  internal.module.ts          # registra guard + controller
  schemas.ts                  # Zod schemas de los DTOs
```

## Guard

```ts
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-internal-api-key'];
    return key === process.env['INTERNAL_API_KEY'];
  }
}
```

## Endpoints por MS

### chatia-backend
- GET /internal/conversations/escalated?ecosystemId&minutesWithoutResponse&limit
- GET /internal/conversations/stats?ecosystemId

### pasarelapagos-backend
- GET  /internal/payments?ecosystemId&organizationId&status&page&limit
- GET  /internal/payments/:id
- POST /internal/payments/:id/retry — body: { reason: string }

### workers-backend
- GET  /internal/jobs/dlq?queue&limit
- POST /internal/jobs/dlq/:queue/:id/retry — body: { reason: string }

## Variable de entorno requerida

`INTERNAL_API_KEY` — mismo valor en:
- grupojl-control-backend
- chatia-backend
- pasarelapagos-backend
- workers-backend
- realsass-sass-back (para sus /internal/organizations)
