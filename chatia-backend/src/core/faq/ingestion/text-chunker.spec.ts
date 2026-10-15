import { chunkText } from '@/core/faq/ingestion/text-chunker.js';

describe('chunkText', () => {
  it('texto vacío o solo espacios → sin fragmentos', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('  \n\n  ')).toEqual([]);
  });

  it('un texto corto es un único fragmento', () => {
    const res = chunkText('Horario de atención: lunes a viernes de 8 a 14.');
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      chunkIndex: 0,
      content: 'Horario de atención: lunes a viernes de 8 a 14.',
    });
  });

  it('ningún fragmento supera el tamaño objetivo (con margen del solapamiento)', () => {
    const text = Array.from(
      { length: 80 },
      (_, i) => `Párrafo ${i}. ${'palabra '.repeat(40)}`,
    ).join('\n\n');
    const chunks = chunkText(text, { size: 500, overlap: 80 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks)
      expect(c.content.length).toBeLessThanOrEqual(500 + 80 + 2);
  });

  it('los índices son consecutivos desde 0 y el tokenCount se estima', () => {
    const chunks = chunkText('a '.repeat(2000), { size: 400, overlap: 50 });
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
    expect(chunks[0]!.tokenCount).toBe(
      Math.ceil(chunks[0]!.content.length / 4),
    );
  });

  it('no pierde contenido: todas las palabras únicas del original aparecen en algún fragmento', () => {
    const words = Array.from({ length: 300 }, (_, i) => `w${i}`);
    const chunks = chunkText(words.join(' '), { size: 200, overlap: 30 });
    const joined = chunks.map((c) => c.content).join(' ');
    for (const w of words) expect(joined).toContain(w);
  });

  it('solapa el final de un fragmento con el inicio del siguiente', () => {
    const text = Array.from(
      { length: 30 },
      (_, i) => `Oración número ${i} del texto de prueba.`,
    ).join(' ');
    const chunks = chunkText(text, { size: 200, overlap: 60 });
    expect(chunks.length).toBeGreaterThan(2);
    const lastWordsOfFirst = chunks[0]!.content.split(' ').slice(-2).join(' ');
    expect(chunks[1]!.content).toContain(lastWordsOfFirst);
  });

  it('sin solapamiento (overlap 0) los fragmentos no repiten texto', () => {
    const chunks = chunkText(
      Array.from({ length: 40 }, (_, i) => `Frase ${i} con contenido.`).join(
        ' ',
      ),
      { size: 120, overlap: 0 },
    );
    expect(chunks.length).toBeGreaterThan(2);
    expect(new Set(chunks.map((c) => c.content)).size).toBe(chunks.length);
  });

  it('una "oración" gigante sin puntuación se corta igual (no se cuelga ni excede)', () => {
    const chunks = chunkText('x'.repeat(5000), { size: 1000, overlap: 100 });
    expect(chunks.length).toBeGreaterThanOrEqual(5);
    for (const c of chunks) expect(c.content.length).toBeLessThanOrEqual(1102);
  });

  it('normaliza saltos de línea de Windows', () => {
    expect(chunkText('uno\r\n\r\ndos')[0]!.content).toBe('uno\n\ndos');
  });
});
