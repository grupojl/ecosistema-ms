// src/infrastructure/security/http-throttler.guard.ts
//
// ThrottlerGuard solo para HTTP. Como APP_GUARD también se evalúa en gRPC y WebSocket,
// y esos contextos no tienen req/res de Express, se los deja pasar (gRPC es red interna;
// el WebSocket se protege con autenticación de handshake).
import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class HttpThrottlerGuard extends ThrottlerGuard {
  override canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return Promise.resolve(true);
    return super.canActivate(context);
  }
}
