import {
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriaDto, ProductoDto } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';
import { RegistrarMovimientoComponent } from './registrar-movimiento.component';

@Component({
  selector: 'app-stock-bajo-minimo',
  standalone: true,
  imports: [RouterLink, RegistrarMovimientoComponent],
  template: `
    <div class="sb-page">
      <nav class="sb-nav">
        <a routerLink="/productos" class="sb-back">← Productos</a>
      </nav>

      <header class="sb-header">
        <h1 class="sb-title">Stock bajo o en mínimo</h1>
        <p class="sb-sub">
          Productos activos con mínimo definido y cantidad igual o por debajo del umbral.
        </p>
      </header>

      <div class="sb-toolbar">
        <label class="sb-filter">
          <span class="sb-filter-label">Categoría</span>
          <select
            class="sb-select"
            [value]="categoriaFiltro() != null ? '' + categoriaFiltro() : ''"
            (change)="onCategoriaChange($event)"
          >
            <option value="">Todas</option>
            @for (c of categorias(); track c.id) {
              <option [value]="'' + c.id">{{ c.nombre }}</option>
            }
          </select>
        </label>
      </div>

      @if (loading()) {
        <p class="sb-muted">Cargando…</p>
      } @else if (error()) {
        <p class="sb-error" role="alert">{{ error() }}</p>
      } @else if (rows().length === 0) {
        <p class="sb-empty">No hay productos bajo mínimo. Buen trabajo.</p>
      } @else {
        <div class="sb-table-wrap">
          <table class="sb-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th class="num">Stock</th>
                <th class="num">Mínimo</th>
                <th class="num">Déficit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr [class.sb-row--warn]="deficit(p) > 0">
                  <td>
                    <a [routerLink]="['/producto', p.id]" class="sb-link">{{ p.nombre }}</a>
                  </td>
                  <td>{{ p.categoriaNombre ?? '—' }}</td>
                  <td class="num">{{ p.cantidad }}</td>
                  <td class="num">{{ p.stockMinimo ?? '—' }}</td>
                  <td class="num sb-deficit">{{ deficit(p) }}</td>
                  <td class="sb-actions">
                    @if (canRegistrarMovimiento()) {
                      <button type="button" class="sb-btn" (click)="abrirMovimiento(p)">
                        Movimiento
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <dialog #movDialog class="sb-dialog" (cancel)="$event.preventDefault()">
        @if (movProducto(); as pr) {
          <div class="sb-dialog-inner">
            <h2 class="sb-dialog-title">Registrar movimiento</h2>
            <p class="sb-dialog-name">{{ pr.nombre }} · actual {{ pr.cantidad }} uds.</p>
            <app-registrar-movimiento [producto]="pr" (completado)="onMovimientoHecho()" />
            <button type="button" class="sb-dialog-close" (click)="cerrarMovimiento()">Cerrar</button>
          </div>
        }
      </dialog>
    </div>
  `,
  styles: `
    .sb-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1rem 1.25rem 2rem;
    }
    .sb-nav {
      margin-bottom: 0.75rem;
    }
    .sb-back {
      color: var(--story-primary);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.9rem;
    }
    .sb-back:hover {
      text-decoration: underline;
    }
    .sb-header {
      margin-bottom: 1rem;
    }
    .sb-title {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--story-text);
    }
    .sb-sub {
      margin: 0.4rem 0 0;
      color: var(--story-text-muted);
      font-size: 0.92rem;
      line-height: 1.45;
    }
    .sb-toolbar {
      margin-bottom: 1rem;
    }
    .sb-filter {
      display: inline-flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.88rem;
    }
    .sb-filter-label {
      color: var(--story-text-muted);
      font-weight: 500;
    }
    .sb-select {
      min-width: 14rem;
      padding: 0.4rem 0.55rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 6px;
      font: inherit;
      background: var(--story-surface);
      color: var(--story-text);
    }
    .sb-muted,
    .sb-empty {
      color: var(--story-text-muted);
      font-size: 0.95rem;
    }
    .sb-error {
      color: var(--story-danger);
      margin: 0;
    }
    .sb-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--story-border);
      border-radius: 8px;
      background: var(--story-surface);
    }
    .sb-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .sb-table th,
    .sb-table td {
      padding: 0.55rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--story-border);
    }
    .sb-table th {
      background: var(--story-bg-page);
      font-weight: 600;
      color: var(--story-text);
    }
    .sb-table .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .sb-row--warn .sb-deficit {
      font-weight: 700;
      color: var(--story-danger);
    }
    .sb-link {
      color: var(--story-primary);
      font-weight: 600;
      text-decoration: none;
    }
    .sb-link:hover {
      text-decoration: underline;
    }
    .sb-actions {
      white-space: nowrap;
    }
    .sb-btn {
      padding: 0.35rem 0.65rem;
      font-size: 0.82rem;
      font-weight: 600;
      border: 1px solid var(--story-primary);
      border-radius: 6px;
      background: var(--story-surface);
      color: var(--story-primary);
      cursor: pointer;
    }
    .sb-btn:hover {
      background: var(--story-bg-page);
    }
    .sb-dialog {
      border: none;
      border-radius: 12px;
      padding: 0;
      max-width: min(100%, 420px);
    }
    .sb-dialog::backdrop {
      background: rgb(15 23 42 / 0.45);
    }
    .sb-dialog-inner {
      padding: 1.1rem 1.2rem;
    }
    .sb-dialog-title {
      margin: 0 0 0.35rem;
      font-size: 1.05rem;
      font-weight: 700;
    }
    .sb-dialog-name {
      margin: 0 0 0.85rem;
      font-size: 0.88rem;
      color: var(--story-text-muted);
    }
    .sb-dialog-close {
      margin-top: 0.75rem;
      padding: 0.4rem 0.85rem;
      font: inherit;
      font-size: 0.86rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 6px;
      background: var(--story-bg-page);
      cursor: pointer;
      color: var(--story-text);
    }
  `,
})
export class StockBajoMinimoComponent implements OnInit {
  private readonly api = inject(CatalogoApiService);
  private readonly auth = inject(AuthService);
  private readonly movDialogRef = viewChild<ElementRef<HTMLDialogElement>>('movDialog');

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly rows = signal<ProductoDto[]>([]);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  protected readonly categoriaFiltro = signal<number | null>(null);
  protected readonly movProducto = signal<ProductoDto | null>(null);

  ngOnInit(): void {
    this.api.getCategorias().subscribe({
      next: (list) => this.categorias.set(list),
      error: () => this.categorias.set([]),
    });
    this.recargar();
  }

  protected canRegistrarMovimiento(): boolean {
    const r = this.auth.currentUser()?.companyRole;
    return r === 'company_admin' || r === 'employee';
  }

  protected deficit(p: ProductoDto): number {
    const min = p.stockMinimo;
    if (min == null) return 0;
    return Math.max(0, min - p.cantidad);
  }

  protected onCategoriaChange(ev: Event): void {
    const sel = (ev.target as HTMLSelectElement).value;
    this.categoriaFiltro.set(sel === '' ? null : Number(sel));
    this.recargar();
  }

  protected abrirMovimiento(p: ProductoDto): void {
    this.movProducto.set(p);
    queueMicrotask(() => this.movDialogRef()?.nativeElement.showModal());
  }

  protected cerrarMovimiento(): void {
    this.movDialogRef()?.nativeElement.close();
    this.movProducto.set(null);
  }

  protected onMovimientoHecho(): void {
    this.cerrarMovimiento();
    this.recargar();
  }

  private recargar(): void {
    this.loading.set(true);
    this.error.set('');
    const cat = this.categoriaFiltro();
    this.api.getProductosBajoMinimo(cat ?? undefined).subscribe({
      next: (list) => {
        this.rows.set(list);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.loading.set(false);
        const msg = err?.error?.message;
        this.error.set(typeof msg === 'string' ? msg : 'No se pudo cargar la lista');
      },
    });
  }
}
