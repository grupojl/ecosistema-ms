// src/core/faq/ingestion/text-chunker.ts
//
// Parte un texto largo en fragmentos para indexar. Respeta párrafos y oraciones cuando puede,
// y solapa el final de un fragmento con el inicio del siguiente para no perder contexto en el corte.

export interface TextChunk {
  content: string;
  chunkIndex: number;
  /** Estimación (≈4 caracteres por token): sirve para métricas, no para facturar. */
  tokenCount: number;
}

export interface ChunkOptions {
  /** Tamaño objetivo en caracteres. */
  size?: number;
  /** Caracteres que se repiten entre fragmentos consecutivos. */
  overlap?: number;
}

const DEFAULT_SIZE = 1000;
const DEFAULT_OVERLAP = 150;

/** Corte duro de un texto sin puntuación: en el último espacio disponible, nunca a mitad de palabra. */
function hardSplit(text: string, size: number): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    let cut = rest.lastIndexOf(' ', size);
    if (cut < size * 0.5) cut = size; // palabra gigante sin espacios (ej. una URL): no hay dónde cortar mejor
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** Separa en unidades "naturales": primero párrafos, y los párrafos enormes por oraciones. */
function toUnits(text: string, size: number): string[] {
  const units: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    const p = paragraph.trim();
    if (!p) continue;
    if (p.length <= size) {
      units.push(p);
      continue;
    }
    // Párrafo más grande que el fragmento: por oraciones, y si una oración sola excede, corte duro
    for (const sentence of p.split(/(?<=[.!?¿?])\s+/)) {
      const s = sentence.trim();
      if (!s) continue;
      units.push(...hardSplit(s, size));
    }
  }
  return units;
}

export function chunkText(
  text: string,
  options: ChunkOptions = {},
): TextChunk[] {
  const size = Math.max(100, options.size ?? DEFAULT_SIZE);
  const overlap = Math.min(
    Math.max(0, options.overlap ?? DEFAULT_OVERLAP),
    Math.floor(size / 2),
  );

  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let current = '';

  for (const unit of toUnits(normalized, size)) {
    if (current && current.length + unit.length + 2 > size) {
      chunks.push(current);
      // El solapamiento arranca en un límite de palabra, no a mitad de una
      const tail = current.slice(-overlap);
      const wordStart = tail.indexOf(' ');
      current =
        overlap > 0 ? (wordStart >= 0 ? tail.slice(wordStart + 1) : tail) : '';
    }
    current = current ? `${current}\n\n${unit}` : unit;
  }
  if (current.trim()) chunks.push(current);

  return chunks.map((content, chunkIndex) => ({
    content,
    chunkIndex,
    tokenCount: Math.ceil(content.length / 4),
  }));
}
