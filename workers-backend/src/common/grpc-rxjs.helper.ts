// workers-backend/src/common/grpc-rxjs.helper.ts
//
// Helper para el interop rxjs / gRPC en workers-backend.
//
// Problema raíz: ClientGrpc.getService<T>() retorna métodos que en runtime
// emiten Observable<T>, pero TypeScript pierde el tipo en el boundary gRPC.
// firstValueFrom() necesita ObservableInput<T> — de ahí el error de tipos.
//
// Patrón canónico (ADR-007): definir la interface del cliente con
// Observable<T> explícito y usar callGrpc() para convertir a Promise.
//
// Elimina todos los ts-expect-error de rxjs/grpc interop del repo.
// Ver notificaciones-backend/src/notifications/dlq/chatia-internal.interface.ts
// para el patrón de interface tipada con Observable<T>.

import { Observable, firstValueFrom } from "rxjs";

/**
 * Convierte una llamada gRPC (que en runtime devuelve Observable) en Promise.
 * Tipar el cliente con la interface correcta elimina la necesidad de casts.
 *
 * Uso correcto — definir la interface explícita del cliente:
 *
 *   interface MiGrpcClient {
 *     miMetodo(req: MiRequest): Observable<MiResponse>;
 *   }
 *   const client = this.grpc.getService<MiGrpcClient>("MiServicio");
 *   const result = await callGrpc(client.miMetodo(request));
 */
export function callGrpc<T>(observable: Observable<T>): Promise<T> {
  return firstValueFrom(observable);
}
