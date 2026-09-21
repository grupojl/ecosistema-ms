// packages/grpc-client/src/grpc-metadata.helper.ts
//
// OBS-MS-01 — Propagación de correlación en llamadas gRPC inter-servicio.
// Patrón: ADR-008 / .claude/architecture/09-observabilidad-norte.md
//
// Uso:
//   import { grpcMetadata, grpcDeadline } from '@ecosistema-ms/grpc-client';
//
//   this.chatiaClient.someMethod(
//     request,
//     grpcMetadata({ requestId, ecosystemId, organizationId }),
//     grpcDeadline(),
//   ).toPromise()

import { Metadata } from '@grpc/grpc-js';

export interface GrpcMetadataOptions {
  requestId?:     string;
  ecosystemId?:   string;
  organizationId?: string;
  service?:       string;
}

/**
 * Crea un objeto Metadata gRPC con los campos de correlación.
 * Si no se pasan valores, la metadata queda vacía (backward compatible).
 */
export function grpcMetadata(opts: GrpcMetadataOptions = {}): Metadata {
  const meta = new Metadata();
  if (opts.requestId)      meta.set('x-request-id',      opts.requestId);
  if (opts.ecosystemId)    meta.set('x-ecosystem-id',    opts.ecosystemId);
  if (opts.organizationId) meta.set('x-organization-id', opts.organizationId);
  if (opts.service)        meta.set('x-source-service',  opts.service);
  return meta;
}

/**
 * Extrae el requestId de metadata gRPC entrante.
 * Usar en los controllers gRPC (GrpcMethod handlers) para propagar el ID.
 */
export function extractRequestId(metadata: Metadata): string | undefined {
  const values = metadata.get('x-request-id');
  return values.length > 0 ? String(values[0]) : undefined;
}
