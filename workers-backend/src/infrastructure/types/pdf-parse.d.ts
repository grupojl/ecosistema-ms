// Declaración mínima de tipos para pdf-parse
// Generada por x.sh — reemplazar con @types/pdf-parse si se publica
// ADR-007: tipos explícitos en todos los boundaries
declare module "pdf-parse" {
  interface PDFInfo {
    Title?:   string;
    Author?:  string;
    Subject?: string;
  }

  interface PDFData {
    numpages:    number;
    numrender:   number;
    info:        PDFInfo;
    metadata:    Record<string, unknown>;
    text:        string;
    version:     string;
  }

  interface PDFOptions {
    pagerender?:  (pageData: { getTextContent: () => Promise<unknown> }) => Promise<string>;
    max?:         number;
    version?:     string;
  }

  function pdfParse(dataBuffer: Buffer | Uint8Array, options?: PDFOptions): Promise<PDFData>;
  export = pdfParse;
}
