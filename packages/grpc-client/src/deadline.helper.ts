// packages/grpc-client/src/deadline.helper.ts
//
// Uso: pasar como tercer argumento a cualquier llamada gRPC para evitar
// que una llamada a un servicio caído bloquee indefinidamente.
//
//   import { grpcDeadline } from '@ecosistema-ms/grpc-client';
//   this.chatiaClient.someMethod(req, new Metadata(), grpcDeadline()).toPromise()

import { Metadata } from '@grpc/grpc-js';

/**
 * Genera un objeto deadline para llamadas gRPC individuales.
 * @param seconds Tiempo máximo de espera (default: 5s)
 */
export function grpcDeadline(seconds = 5): { deadline: Date } {
  const d = new Date();
  d.setSeconds(d.getSeconds() + seconds);
  return { deadline: d };
}

export const DEFAULT_GRPC_DEADLINE_S = 5;
