// chatia-backend/src/analytics/analytics.service.ts
//
// ADR-003 A-2.5 — ELIMINADO en semana 6.
// Este módulo ya no tiene lógica propia. Es un placeholder vacío.
//
// MIGRACIÓN WELVER:
//   Antes: GET chatia-backend/api/v1/analytics/overview
//   Ahora: GET analytics-backend/api/v1/analytics/overview
//
// Las URLs de analytics-backend en Railway:
//   HTTP:  https://analytics-backend-{env}.railway.app
//   gRPC:  analytics-backend.railway.internal:5004
//
// Este archivo se puede eliminar una vez que welver haya migrado sus llamadas.

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor() {
    this.logger.warn(
      'chatia-backend AnalyticsService está vacío. ' +
      'Welver debe llamar a analytics-backend directamente. Ver ADR-003 A-2.5.',
    );
  }
}
