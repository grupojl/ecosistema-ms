// src/infrastructure/transport/grpc/grpc-auth.guard.ts
//
// Autenticación entre servicios por gRPC con la clave interna (metadata `x-internal-api-key`).
// Hoy la red privada de Railway es la única barrera; con GRPC_AUTH_ENFORCED=true además se exige la clave.
// Se activa SOLO cuando todos los clientes (workers, pasarela, ...) ya la envían: grpcMetadata() de
// @ecosistema-ms/grpc-client no la agrega todavía — activar antes cortaría esas llamadas.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { status as GrpcStatus, type Metadata } from '@grpc/grpc-js';
import { safeEqual } from '@/infrastructure/security/safe-equal.js';

@Injectable()
export class GrpcAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env['GRPC_AUTH_ENFORCED'] !== 'true') return true;

    const metadata = context.switchToRpc().getContext<Metadata>();
    const received = metadata?.get('x-internal-api-key')?.[0];
    const expected =
      process.env['INTERNAL_API_KEY'] || process.env['CHAT_INTERNAL_API_KEY'];

    if (
      !safeEqual(typeof received === 'string' ? received : undefined, expected)
    ) {
      throw new RpcException({
        code: GrpcStatus.UNAUTHENTICATED,
        message: 'Clave interna inválida o ausente',
      });
    }
    return true;
  }
}
