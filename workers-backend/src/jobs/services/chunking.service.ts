// workers-backend/src/jobs/services/chunking.service.ts
//
// Extrae texto de documentos y divide en chunks con overlap.
// Soporta: TEXT (plano), URL (fetch + content-type), BASE64 (decodifica + mime).
// PDF y DOCX via dynamic import de pdf-parse y mammoth (sin Python).

import { Injectable, Logger } from '@nestjs/common';
import type { FaqDocumentSource } from '../dto/faq-ingest-job.dto.js';

const CHUNK_SIZE    = 500;  // tokens ≈ chars / 4
const CHUNK_OVERLAP = 50;
const CHARS_PER_TOK = 4;

export interface TextChunk {
  content:    string;
  chunkIndex: number;
  tokenCount: number;
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  async extractAndChunk(
    content:   string,
    source:    FaqDocumentSource,
    fileName?: string,
  ): Promise<TextChunk[]> {
    const text = await this.extractText(content, source, fileName);
    return this.chunkText(text);
  }

  private async extractText(content: string, source: FaqDocumentSource, fileName?: string): Promise<string> {
    switch (source) {
      case 'TEXT': return content;
      case 'URL': {
        const res    = await fetch(content);
        if (!res.ok) throw new Error(`Error descargando ${content}: ${res.status}`);
        const ct     = res.headers.get('content-type') ?? '';
        const buffer = Buffer.from(await res.arrayBuffer());
        return this.extractFromBuffer(buffer, ct, fileName);
      }
      case 'BASE64': {
        const buffer = Buffer.from(content, 'base64');
        const ext    = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
        const ct     = ext === 'pdf'  ? 'application/pdf'
                     : ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                     : 'text/plain';
        return this.extractFromBuffer(buffer, ct, fileName);
      }
      default: throw new Error(`Fuente no soportada: ${source as string}`);
    }
  }

  private async extractFromBuffer(buffer: Buffer, mimeType: string, fileName?: string): Promise<string> {
    if (mimeType.includes('pdf')) {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        return (await pdfParse(buffer)).text;
      } catch {
        throw new Error('pdf-parse no instalado. Agregar a workers-backend/package.json');
      }
    }
    if (mimeType.includes('wordprocessingml') || (fileName ?? '').endsWith('.docx')) {
      try {
        const mammoth = await import('mammoth');
        return (await mammoth.extractRawText({ buffer })).value;
      } catch {
        throw new Error('mammoth no instalado. Agregar a workers-backend/package.json');
      }
    }
    return buffer.toString('utf-8');
  }

  private chunkText(text: string): TextChunk[] {
    const cleaned    = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];

    const chunkChars   = CHUNK_SIZE    * CHARS_PER_TOK;
    const overlapChars = CHUNK_OVERLAP * CHARS_PER_TOK;
    const step         = chunkChars - overlapChars;
    const chunks: TextChunk[] = [];

    let i = 0;
    while (i < cleaned.length) {
      const content = cleaned.slice(i, i + chunkChars).trimEnd();
      const tokens  = Math.ceil(content.length / CHARS_PER_TOK);
      chunks.push({ content, chunkIndex: chunks.length, tokenCount: tokens });
      i += step;
    }

    this.logger.debug(`Chunking: ${cleaned.length} chars → ${chunks.length} chunks`);
    return chunks;
  }
}
