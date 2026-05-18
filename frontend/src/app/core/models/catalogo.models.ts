export interface CategoriaDto {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface MovimientoStockDto {
  id: number;
  tipo: string;
  cantidad: number;
  fecha: string;
  observacion: string | null;
  usuario: string;
}

export interface ProductoDto {
  id: number;
  nombre: string;
  descripcion: string | null;
  codigo: string;
  precio: number | null;
  cantidad: number;
  stockMinimo: number | null;
  activo: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  imagen: string | null;
  categoriaId: number | null;
  categoriaNombre: string | null;
}

export interface SerieDiaMovimientoDto {
  fecha: string;
  entradasUnidades: number;
  salidasUnidades: number;
  ajustesUnidades: number;
}

export interface ProductoSalidaResumenDto {
  productoId: number;
  nombreProducto: string;
  unidadesSalida: number;
}

export interface InventarioEstadisticasDto {
  totalMovimientos: number;
  unidadesEntrada: number;
  unidadesSalida: number;
  unidadesAjuste: number;
  seriePorDia: SerieDiaMovimientoDto[];
  topSalidasProducto: ProductoSalidaResumenDto[];
}
