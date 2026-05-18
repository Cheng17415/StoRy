import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CategoriaDto,
  InventarioEstadisticasDto,
  MovimientoStockDto,
  ProductoDto,
} from '../models/catalogo.models';

export interface ProductoFormPayload {
  nombre: string;
  cantidad: number;
  precio: number;
  /** Si es null, no se aplica umbral de alerta de stock bajo. */
  stockMinimo: number | null;
  /** Notas del producto (mapea a `descripcion` en API). */
  descripcion: string;
  imagen: File | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogoApiService {
  private readonly http = inject(HttpClient);

  getCategorias(): Observable<CategoriaDto[]> {
    return this.http.get<CategoriaDto[]>('/api/categorias');
  }

  getProductos(): Observable<ProductoDto[]> {
    return this.http.get<ProductoDto[]>('/api/productos');
  }

  getProducto(id: number): Observable<ProductoDto> {
    return this.http.get<ProductoDto>(`/api/productos/${id}`);
  }

  getProductoMovimientos(id: number): Observable<MovimientoStockDto[]> {
    return this.http.get<MovimientoStockDto[]>(`/api/productos/${id}/movimientos`);
  }

  getInventarioEstadisticas(desde: string, hasta: string): Observable<InventarioEstadisticasDto> {
    return this.http.get<InventarioEstadisticasDto>('/api/productos/estadisticas', {
      params: { desde, hasta },
    });
  }

  createProducto(payload: ProductoFormPayload): Observable<ProductoDto> {
    const fd = new FormData();
    fd.append('nombre', payload.nombre);
    fd.append('descripcion', payload.descripcion ?? '');
    fd.append('cantidad', String(payload.cantidad));
    fd.append('precio', String(payload.precio));
    fd.append('stockMinimo', payload.stockMinimo == null ? '' : String(payload.stockMinimo));
    if (payload.imagen) {
      fd.append('imagen', payload.imagen);
    }
    return this.http.post<ProductoDto>('/api/productos', fd);
  }

  updateProducto(id: number, payload: ProductoFormPayload): Observable<ProductoDto> {
    const fd = new FormData();
    fd.append('nombre', payload.nombre);
    fd.append('descripcion', payload.descripcion ?? '');
    fd.append('cantidad', String(payload.cantidad));
    fd.append('precio', String(payload.precio));
    fd.append('stockMinimo', payload.stockMinimo == null ? '' : String(payload.stockMinimo));
    if (payload.imagen) {
      fd.append('imagen', payload.imagen);
    }
    return this.http.post<ProductoDto>(`/api/productos/${id}/update`, fd);
  }

  deleteProducto(id: number): Observable<void> {
    return this.http.delete<void>(`/api/productos/${id}`);
  }
}
