import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { TenantContext } from "../types/tenant-context";

/** @Tenant() — inyecta el TenantContext resuelto por TenantGuard. */
export const Tenant = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant as TenantContext;
  },
);
