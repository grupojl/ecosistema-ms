// src/infrastructure/common/guards/tenant-throttler.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  /**
   * Clave de throttling: proyecto (si existe) > organización > IP
   * Endpoints de IA usan x-project-id para limitar por proyecto independientemente.
   */
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = (req['headers'] ?? {}) as Record<
      string,
      string | undefined
    >;
    const projectId = headers['x-project-id'];
    const organizationId = headers['x-organization-id'];
    const ip = (req['ip'] as string | undefined) ?? 'unknown';

    if (projectId) return Promise.resolve(`proj:${projectId}`);
    if (organizationId) return Promise.resolve(`org:${organizationId}`);
    return Promise.resolve(ip);
  }

  protected shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ path?: string }>();
    // Webhooks de Meta/TikTok son ráfagas cortas — sin rate limit
    return Promise.resolve((req.path ?? '').includes('/webhooks/'));
  }
}
