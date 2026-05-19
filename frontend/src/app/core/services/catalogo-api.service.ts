import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import {
  CarpetaArbolDto,
  CarpetaDto,
  InventarioEstadisticasDto,
  CategoriaDto,
  ClonarCarpetaResponseDto,
  MovimientoStockDto,
  ProductoDto,
} from '../models/catalogo.models';

export type TipoMovimientoStock = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface RegistrarMovimientoPayload {
  tipo: TipoMovimientoStock;
  cantidad: number;
  observacion?: string;
}

export interface CarpetaFormPayload {
  nombre: string;
  /** Notas de la carpeta (mapea a `descripcion` en API). */
  descripcion: string;
  parentId?: number | null;
}

export interface ProductoFormPayload {
  nombre: string;
  cantidad: number;
  precio: number;
  /** Si es null, no se aplica umbral de alerta de stock bajo. */
  stockMinimo: number | null;
  /** Notas del producto (mapea a `descripcion` en API). */
  descripcion: string;
  imagen: File | null;
  /** Carpeta actual al crear; omitir para raíz. */
  carpetaId?: number | null;
}

export interface CategoriaFormPayload {
  nombre: string;
  descripcion?: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogoApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  /** Bearer explícito: refuerza el interceptor en todas las rutas de catálogo que exigen sesión. */
  private authBearerOpts(): { headers: HttpHeaders } | Record<string, never> {
    const token = this.auth.getToken();
    if (!token) {
      return {};
    }
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  getCategorias(): Observable<CategoriaDto[]> {
    return this.http.get<CategoriaDto[]>('/api/categorias', this.authBearerOpts());
  }

  createCategoria(payload: CategoriaFormPayload): Observable<CategoriaDto> {
    return this.http.post<CategoriaDto>(
      '/api/categorias',
      { nombre: payload.nombre, descripcion: payload.descripcion ?? '' },
      this.authBearerOpts(),
    );
  }

  /** Lista productos en la carpeta dada; {@code null} = sin carpeta (raíz). */
  getProductos(carpetaId?: number | null, categoriaId?: number | null): Observable<ProductoDto[]> {
    let params = new HttpParams();
    if (carpetaId != null) {
      params = params.set('carpetaId', String(carpetaId));
    }
    if (categoriaId != null && categoriaId > 0) {
      params = params.set('categoriaId', String(categoriaId));
    }
    return this.http.get<ProductoDto[]>('/api/productos', { params, ...this.authBearerOpts() });
  }

  /** Todos los productos de la empresa (cualquier carpeta). */
  getTodosProductosEmpresa(): Observable<ProductoDto[]> {
    return this.http.get<ProductoDto[]>('/api/productos/todos', this.authBearerOpts());
  }

  getCarpetasArbol(): Observable<CarpetaArbolDto[]> {
    return this.http.get<CarpetaArbolDto[]>('/api/carpetas/arbol', this.authBearerOpts());
  }

  crearCarpeta(payload: CarpetaFormPayload): Observable<CarpetaDto> {
    const body: {
      nombre: string;
      descripcion: string;
      parentId?: number;
    } = {
      nombre: payload.nombre,
      descripcion: payload.descripcion ?? '',
    };
    if (payload.parentId != null) {
      body.parentId = payload.parentId;
    }
    return this.http.post<CarpetaDto>('/api/carpetas', body, this.authBearerOpts());
  }

  renombrarCarpeta(id: number, nombre: string): Observable<CarpetaDto> {
    return this.http.patch<CarpetaDto>(`/api/carpetas/${id}`, { nombre }, this.authBearerOpts());
  }

  moverCarpeta(id: number, parentId: number | null): Observable<CarpetaDto> {
    return this.http.patch<CarpetaDto>(`/api/carpetas/${id}/parent`, { parentId }, this.authBearerOpts());
  }

  eliminarCarpeta(id: number): Observable<void> {
    return this.http.delete<void>(`/api/carpetas/${id}`, this.authBearerOpts());
  }

  clonarCarpeta(id: number, parentId?: number | null): Observable<ClonarCarpetaResponseDto> {
    const body = parentId !== undefined ? { parentId } : {};
    return this.http.post<ClonarCarpetaResponseDto>(
      `/api/carpetas/${id}/clone`,
      body,
      this.authBearerOpts(),
    );
  }

  getProductosBajoMinimo(categoriaId?: number | null): Observable<ProductoDto[]> {
    let params = new HttpParams().set('bajoMinimo', 'true');
    if (categoriaId != null && categoriaId > 0) {
      params = params.set('categoriaId', String(categoriaId));
    }
    return this.http.get<ProductoDto[]>('/api/productos', {
      params,
      ...this.authBearerOpts(),
    });
  }

  registrarMovimiento(
    productoId: number,
    payload: RegistrarMovimientoPayload,
  ): Observable<MovimientoStockDto> {
    return this.http.post<MovimientoStockDto>(
      `/api/productos/${productoId}/movimiento`,
      payload,
      this.authBearerOpts(),
    );
  }

  getProducto(id: number): Observable<ProductoDto> {
    return this.http.get<ProductoDto>(`/api/productos/${id}`, this.authBearerOpts());
  }

  getProductoMovimientos(id: number): Observable<MovimientoStockDto[]> {
    return this.http.get<MovimientoStockDto[]>(`/api/productos/${id}/movimientos`, this.authBearerOpts());
  }

  updateProductoStockMinimo(id: number, stockMinimo: number | null): Observable<ProductoDto> {
    return this.http.patch<ProductoDto>(
      `/api/productos/${id}/stock-minimo`,
      { stockMinimo },
      this.authBearerOpts(),
    );
  }

  getInventarioEstadisticas(
    desde: string,
    hasta: string,
    categoriaId?: number | null,
  ): Observable<InventarioEstadisticasDto> {
    let params = new HttpParams().set('desde', desde).set('hasta', hasta);
    if (categoriaId != null && categoriaId > 0) {
      params = params.set('categoriaId', String(categoriaId));
    }
    return this.http.get<InventarioEstadisticasDto>('/api/productos/estadisticas', {
      params,
      ...this.authBearerOpts(),
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
    if (payload.carpetaId != null) {
      fd.append('carpetaId', String(payload.carpetaId));
    }
    return this.http.post<ProductoDto>('/api/productos', fd, this.authBearerOpts());
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
    if ('carpetaId' in payload && payload.carpetaId !== undefined) {
      fd.append('carpetaId', payload.carpetaId == null ? '' : String(payload.carpetaId));
    }
    return this.http.post<ProductoDto>(`/api/productos/${id}/update`, fd, this.authBearerOpts());
  }

  moverProductoCarpeta(productoId: number, carpetaId: number | null): Observable<ProductoDto> {
    return this.http.patch<ProductoDto>(
      `/api/productos/${productoId}/carpeta`,
      { carpetaId },
      this.authBearerOpts(),
    );
  }

  agregarProductoCategoria(
    productoId: number,
    payload: { categoriaId?: number; nombre?: string },
  ): Observable<ProductoDto> {
    return this.http.post<ProductoDto>(
      `/api/productos/${productoId}/categorias`,
      payload,
      this.authBearerOpts(),
    );
  }

  quitarProductoCategoria(productoId: number, categoriaId: number): Observable<ProductoDto> {
    return this.http.delete<ProductoDto>(
      `/api/productos/${productoId}/categorias/${categoriaId}`,
      this.authBearerOpts(),
    );
  }

  clonarProducto(id: number): Observable<ProductoDto> {
    return this.http.post<ProductoDto>(`/api/productos/${id}/clone`, {}, this.authBearerOpts());
  }

  deleteProducto(id: number): Observable<void> {
    return this.http.delete<void>(`/api/productos/${id}`, this.authBearerOpts());
  }
}
