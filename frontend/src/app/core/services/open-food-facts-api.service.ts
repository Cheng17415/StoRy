import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { OpenFoodFactsProductDto } from '../models/catalogo.models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class OpenFoodFactsApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private authBearerOpts(): { headers: HttpHeaders } | Record<string, never> {
    const token = this.auth.getToken();
    if (!token) {
      return {};
    }
    return { headers: new HttpHeaders({ Authorization: `Bearer ${token}` }) };
  }

  buscarProducto(codigoBarras: string): Observable<OpenFoodFactsProductDto> {
    const code = encodeURIComponent(codigoBarras.trim());
    return this.http.get<OpenFoodFactsProductDto>(
      `/api/open-food-facts/product/${code}`,
      this.authBearerOpts(),
    );
  }
}
