/**
 * jsPDF Helvetica no soporta bien U+2212 (−), U+2014 (—), etc.
 * Sustituir por ASCII evita caracteres rotos en tablas PDF.
 */
export function pdfSafeText(value: string): string {
  return value
    .replace(/\u2212/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
    .replace(/\u2192/g, '->');
}
