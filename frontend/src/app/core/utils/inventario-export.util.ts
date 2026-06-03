/** Paleta compartida exportación inventario (Excel + PDF), alineada con /stock. */
export const INVENTARIO_EXPORT_COLORS = {
  primary: '#1e40af',
  primaryBorder: '#1e3a8a',
  text: '#0f172a',
  muted: '#475569',
  meta: '#64748b',
  white: '#ffffff',
  rowAlt: '#f8fafc',
  warnBg: '#fef2f2',
  warn: '#b91c1c',
  border: '#e2e8f0',
  positive: '#16a34a',
  negative: '#b91c1c',
} as const;

export function hexToArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Valores separados por tabulador: Excel abre cada campo en su columna. */
export function escapeTsvCell(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

export function fechaExportHoy(): string {
  return new Date().toISOString().slice(0, 10);
}
