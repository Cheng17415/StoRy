import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [AsyncPipe],
  template: `
    <h2>Categorías</h2>
    @if (categorias$ | async; as list) {
      @if (list.length === 0) {
        <p>No hay categorías (tabla vacía).</p>
      } @else {
        <ul>
          @for (c of list; track c.id) {
            <li><strong>{{ c.nombre }}</strong> — {{ c.descripcion ?? '—' }}</li>
          }
        </ul>
      }
    } @else {
      <p>Cargando…</p>
    }
  `,
})
export class CategoriasComponent {
  protected readonly categorias$ = inject(CatalogoApiService).getCategorias();
}
