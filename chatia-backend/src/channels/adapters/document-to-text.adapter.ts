// chatia-backend/src/channels/adapters/document-to-text.adapter.ts
//
// Extrae texto de documentos enviados por WhatsApp (PDF, txt, docx).
// Reutiliza el mismo flujo de descarga que el FAQ ingest — sin proveedor nuevo.
// Para PDFs usa extracción básica de texto; documentos complejos → truncado.
//
// Fallback: si no se puede leer → pregunta al usuario qué necesita
// Ref: .claude/modules/chatia-backend/multimodal-adapters.md
import { Injectable, Logger } from '@nestjs/common';
import type { IMultimodalAdapter, MultimodalInput } from '@/channels/adapters/multimodal.interface.js';

const MAX_CHARS = 4_000; // truncar documentos largos antes de enviar al LLM

@Injectable()
export class DocumentToTextAdapter implements IMultimodalAdapter {
  readonly supportedType = 'document' as const;
  private readonly logger = new Logger(DocumentToTextAdapter.name);

  async toText(input: MultimodalInput): Promise<string> {
    if (!input.mediaUrl) {
      return input.content || '[Documento recibido sin URL]';
    }

    try {
      const text = await this.extractText(input.mediaUrl);
      if (!text.trim()) {
        return '[El documento no contiene texto legible. ¿Podés describirme qué necesitás?]';
      }
      const truncated = text.length > MAX_CHARS
        ? text.slice(0, MAX_CHARS) + '\n[...documento truncado por longitud]'
        : text;

      this.logger.log(`[DOC] Extraídos ${truncated.length} chars del documento`);
      return `[Documento enviado por el usuario]\n${truncated}`;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`[DOC] No se pudo leer el documento: ${msg}`);
      return '[Recibí tu documento pero no pude leerlo. ¿Es un PDF? ¿Podés describirme qué necesitás?]';
    }
  }

  private async extractText(mediaUrl: string): Promise<string> {
    const res = await fetch(mediaUrl);
    if (!res.ok) throw new Error(`No se pudo descargar el documento: ${res.status}`);

    const contentType = res.headers.get('content-type') ?? '';
    const buffer      = Buffer.from(await res.arrayBuffer());

    // Texto plano
    if (contentType.includes('text/plain')) {
      return buffer.toString('utf-8');
    }

    // PDF — extracción básica de texto (sin dependencias externas)
    // Para PDFs complejos con imágenes → retorna texto parcial
    if (contentType.includes('pdf') || mediaUrl.toLowerCase().includes('.pdf')) {
      return this.extractPdfText(buffer);
    }

    // Otros formatos — intentar como texto
    return buffer.toString('utf-8').slice(0, MAX_CHARS);
  }

  private extractPdfText(buffer: Buffer): string {
    // Extracción básica de texto de PDF sin librerías externas
    // Busca streams de texto en el PDF (suficiente para PDFs generados digitalmente)
    const content = buffer.toString('latin1');
    const textChunks: string[] = [];

    // Extraer texto entre BT (begin text) y ET (end text) markers
    const btEtRegex = /BT([\s\S]*?)ET/g;
    let match: RegExpExecArray | null;
    while ((match = btEtRegex.exec(content)) !== null) {
      const block = match[1];
      // Extraer strings entre paréntesis: (texto)
      const strRegex = /\(([^)]+)\)/g;
      let strMatch: RegExpExecArray | null;
      while ((strMatch = strRegex.exec(block)) !== null) {
        const text = strMatch[1].replace(/\\n/g, '\n').replace(/\\r/g, '').trim();
        if (text.length > 1) textChunks.push(text);
      }
    }

    return textChunks.join(' ').trim();
  }
}
