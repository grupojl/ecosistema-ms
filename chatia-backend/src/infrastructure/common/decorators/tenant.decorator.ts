// src/infrastructure/common/decorators/tenant.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { TenantContext } from '@/infrastructure/common/types/tenant-context.js';

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { tenant?: TenantContext }>();
    return request.tenant;
  },
);
