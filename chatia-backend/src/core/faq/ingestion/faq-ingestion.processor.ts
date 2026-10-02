// chatia-backend/src/faq/ingestion/faq-ingestion.processor.ts
//
// ADR-003 W-1.3 — ELIMINADO en semana 7.
// El procesamiento de FAQ fue movido a workers-backend/FaqIngestProcessor.
//
// Este archivo existe solo para evitar errores de importación si hay
// referencias residuales. Puede eliminarse en el próximo cleanup.
//
// El producer es: chatia-backend/src/faq/ingestion/faq-ingestion.service.ts
// El consumer es: workers-backend/src/jobs/processors/faq-ingest.processor.ts

import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class FaqIngestionProcessor {
  private readonly logger = new Logger(FaqIngestionProcessor.name);

  constructor() {
    this.logger.warn(
      'FaqIngestionProcessor está vacío — ADR-003 W-1.3. ' +
      'El procesamiento ocurre en workers-backend.',
    );
  }
}
