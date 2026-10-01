// Declaración mínima de tipos para mammoth
// Generada por x.sh — ADR-007: tipos explícitos en todos los boundaries
declare module "mammoth" {
  interface ConversionOptions {
    styleMap?: string | string[];
  }

  interface ConversionResult {
    value:    string;   // HTML o texto extraído
    messages: Array<{
      type:     "warning" | "error";
      message:  string;
      paragraph?: unknown;
    }>;
  }

  function convertToHtml(
    input:    { buffer: Buffer } | { path: string },
    options?: ConversionOptions,
  ): Promise<ConversionResult>;

  function extractRawText(
    input:    { buffer: Buffer } | { path: string },
    options?: ConversionOptions,
  ): Promise<ConversionResult>;
}
