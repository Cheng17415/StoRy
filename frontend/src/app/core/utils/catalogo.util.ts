import type { MovimientoStockDto, ProductoDto } from '../models/catalogo.models';

/** Producto con cantidad en o por debajo del mínimo configurado. */
export function esStockBajo(p: ProductoDto): boolean {
  if (p.stockMinimo == null) {
    return false;
  }
  return p.cantidad <= p.stockMinimo;
}

/** Etiqueta legible del tipo de movimiento de stock. */
export function tipoMovimientoLabel(tipo: string): string {
  switch (tipo) {
    case 'ENTRADA':
      return 'Entrada';
    case 'SALIDA':
      return 'Salida';
    case 'AJUSTE':
      return 'Ajuste';
    default:
      return tipo;
  }
}

/** Cantidad con signo según tipo (entrada +n, salida −n, ajuste → n). */
export function movCantidadDisplay(m: MovimientoStockDto): string {
  switch (m.tipo) {
    case 'ENTRADA':
      return `+${m.cantidad}`;
    case 'SALIDA':
      return `−${m.cantidad}`;
    case 'AJUSTE':
      return `→ ${m.cantidad}`;
    default:
      return String(m.cantidad);
  }
}

/** Clase CSS del badge Nutri-Score (p. ej. `story-nutri--a`). */
export function nutriScoreClass(score: string): string {
  return `story-nutri--${score.trim().charAt(0).toLowerCase()}`;
}

/** Normaliza stock mínimo del formulario: entero ≥ 0 o null si vacío/inválido. */
export function normalizeStockMinimo(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) {
    return null;
  }
  return n < 0 ? null : Math.floor(n);
}
