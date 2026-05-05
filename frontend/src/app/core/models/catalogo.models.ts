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
