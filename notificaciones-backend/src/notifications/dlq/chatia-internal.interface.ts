// notificaciones-backend/src/notifications/dlq/chatia-internal.interface.ts
// Tipado correcto del cliente gRPC de chatia para el DlqMonitorService.
// Reemplaza el @ts-expect-error — rxjs interop de dlq-monitor.service.ts
// ADR-007: sin @ts-expect-error en produccion.
import type { Observable } from 'rxjs';

export interface ChatiaNotifyRequest {
  organizationId: string;
  ecosystemId:    string;
  type:           string;
  title:          string;
  body:           string;
}

export interface ChatiaNotifyResponse {
  success: boolean;
}

/**
 * Interface tipada del cliente gRPC de chatia.
 * Los metodos gRPC retornan Observable<T> — usar firstValueFrom() para await.
 *
 * Uso correcto:
 *   const result = await firstValueFrom(this.chatiaClient.notifySystem(req));
 *
 * Incorrecto (deprecated rxjs, causa el @ts-expect-error):
 *   await this.chatiaClient.notifySystem(req).toPromise();
 */
export interface ChatiaInternalGrpcClient {
  notifySystem(req: ChatiaNotifyRequest): Observable<ChatiaNotifyResponse>;
}
