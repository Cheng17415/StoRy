import {
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CategoriaDto, ProductoDto, formatProductoCategorias } from '../../core/models/catalogo.models';
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
        <a routerLink="/productos" class="sb-back">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6" />
          </svg>
          Volver a productos
        </a>
      </nav>

      <section class="sb-summary" aria-label="Resumen de stock bajo">
        <article class="sb-summary-card">
          <span class="summary-icon summary-icon--red" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </span>
          <div>
            <span class="summary-label">Alertas</span>
            <strong class="summary-value">{{ rows().length }}</strong>
          </div>
        </article>
        <article class="sb-summary-card">
          <span class="summary-icon summary-icon--amber" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 17V9M12 17V5M17 17v-6M3 21h18" />
            </svg>
          </span>
          <div>
            <span class="summary-label">Déficit total</span>
            <strong class="summary-value">{{ deficitTotal() }}</strong>
          </div>
        </article>
        <article class="sb-summary-card">
          <span class="summary-icon summary-icon--blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
          </span>
          <div>
            <span class="summary-label">Filtro</span>
            <strong class="summary-value summary-value--small">{{ categoriaActivaLabel() }}</strong>
          </div>
        </article>
      </section>

      <div class="sb-toolbar">
        <label class="sb-filter">
          <span class="sb-filter-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
          </span>
          <select
            class="sb-select"
            [value]="categoriaFiltro() != null ? '' + categoriaFiltro() : ''"
            (change)="onCategoriaChange($event)"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            @for (c of categorias(); track c.id) {
              <option [value]="'' + c.id">{{ c.nombre }}</option>
            }
          </select>
        </label>
      </div>

      @if (loading()) {
        <p class="sb-muted">Cargando…</p>
      } @else if (error()) {
        <p class="sb-error" role="alert">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          {{ error() }}
        </p>
      } @else if (rows().length === 0) {
        <div class="sb-empty">
          <span class="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="34" height="34">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <h2>Todo bajo control</h2>
          <p>No hay productos bajo mínimo en este filtro.</p>
        </div>
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
                  <td>{{ formatProductoCategorias(p) }}</td>
                  <td class="num">{{ p.cantidad }}</td>
                  <td class="num">
                    @if (canEditStockMinimo()) {
                      <input
                        class="sb-min-input"
                        type="number"
                        min="0"
                        step="1"
                        [value]="stockMinimoDraftValue(p)"
                        [disabled]="savingStockMinimoId() === p.id"
                        (input)="onStockMinimoDraft(p.id, $event)"
                        aria-label="Stock mínimo"
                      />
                    } @else {
                      {{ p.stockMinimo ?? '—' }}
                    }
                  </td>
                  <td class="num sb-deficit">{{ deficit(p) }}</td>
                  <td class="sb-actions">
                    @if (canEditStockMinimo()) {
                      <button
                        type="button"
                        class="sb-btn sb-btn-primary"
                        [disabled]="savingStockMinimoId() === p.id || !stockMinimoChanged(p)"
                        (click)="guardarStockMinimo(p)"
                      >
                        {{ savingStockMinimoId() === p.id ? 'Guardando…' : 'Guardar mínimo' }}
                      </button>
                    }
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
            <p class="sb-dialog-name">{{ pr.nombre }} · actual {{ pr.cantidad }}.</p>
            <app-registrar-movimiento [producto]="pr" (completado)="onMovimientoHecho()" />
            <button type="button" class="sb-dialog-close" (click)="cerrarMovimiento()">Cerrar</button>
          </div>
        }
      </dialog>
    </div>
  `,
  styles: `
    .sb-page {
      max-width: 72rem;
      margin: 0 auto;
      padding: 0.5rem 1rem 3rem;
    }

    .sb-nav {
      margin-bottom: 1rem;
    }

    .sb-back {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--story-text-muted);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 0.4rem 0.7rem;
      margin-left: -0.7rem;
      border-radius: 8px;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .sb-back:hover {
      color: var(--story-primary);
      background: rgba(30, 64, 175, 0.08);
    }

    .sb-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 1rem;
      padding: 1.6rem;
      border: 1px solid var(--story-border);
      border-radius: 20px;
      background:
        radial-gradient(700px 260px at 0% 0%, rgba(185, 28, 28, 0.10), transparent 60%),
        radial-gradient(560px 240px at 100% 120%, rgba(245, 158, 11, 0.16), transparent 65%),
        linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(15, 23, 42, 0.05);
      position: relative;
      overflow: hidden;
    }

    .sb-header::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--story-danger), var(--story-accent), var(--story-primary));
    }

    .sb-eyebrow {
      margin: 0 0 0.25rem;
      color: var(--story-danger);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .sb-title {
      margin: 0;
      font-size: clamp(1.75rem, 4vw, 2.4rem);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.05;
      color: #0f172a;
    }

    .sb-sub {
      max-width: 36rem;
      margin: 0.65rem 0 0;
      color: #475569;
      font-size: 0.98rem;
      line-height: 1.6;
    }

    .sb-hero-icon {
      width: 5.5rem;
      height: 5.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 24px;
      background: rgba(185, 28, 28, 0.08);
      color: var(--story-danger);
      flex-shrink: 0;
    }

    .sb-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .sb-summary-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.9rem 1rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
      transition: border-color 0.18s ease, transform 0.18s ease;
    }

    .sb-summary-card:hover {
      border-color: var(--story-border-strong);
      transform: translateY(-1px);
    }

    .summary-icon {
      width: 2.35rem;
      height: 2.35rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
      flex-shrink: 0;
    }

    .summary-icon--red {
      background: rgba(185, 28, 28, 0.09);
      color: var(--story-danger);
    }

    .summary-icon--amber {
      background: rgba(245, 158, 11, 0.14);
      color: var(--story-accent-muted);
    }

    .summary-icon--blue {
      background: rgba(30, 64, 175, 0.10);
      color: var(--story-primary);
    }

    .summary-label {
      display: block;
      color: var(--story-text-muted);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .summary-value {
      display: block;
      margin-top: 0.1rem;
      color: #0f172a;
      font-size: 1.2rem;
      letter-spacing: -0.015em;
    }

    .summary-value--small {
      font-size: 1rem;
    }

    .sb-toolbar {
      margin-bottom: 1rem;
      padding: 0.75rem 0.85rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }

    .sb-filter {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-width: 14rem;
    }

    .sb-filter-icon {
      position: absolute;
      left: 0.7rem;
      display: inline-flex;
      color: var(--story-text-muted);
      pointer-events: none;
    }

    .sb-select {
      width: 100%;
      min-height: 2.5rem;
      padding: 0.55rem 0.75rem 0.55rem 2.35rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 10px;
      font: inherit;
      font-size: 0.9rem;
      background: var(--story-surface);
      color: #0f172a;
      cursor: pointer;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .sb-select:focus {
      outline: none;
      border-color: var(--story-primary);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .sb-muted,
    .sb-empty {
      color: var(--story-text-muted);
      font-size: 0.95rem;
    }

    .sb-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--story-danger);
      margin: 0;
      padding: 0.7rem 0.9rem;
      background: rgba(185, 28, 28, 0.07);
      border: 1px solid rgba(185, 28, 28, 0.2);
      border-radius: 12px;
      font-size: 0.88rem;
      font-weight: 500;
    }

    .sb-empty {
      text-align: center;
      padding: 2.25rem 1.5rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 18px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }

    .empty-icon {
      width: 4rem;
      height: 4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 18px;
      background: rgba(21, 128, 61, 0.10);
      color: var(--story-success);
      margin-bottom: 0.8rem;
    }

    .sb-empty h2 {
      margin: 0 0 0.35rem;
      color: #0f172a;
      font-size: 1.35rem;
      letter-spacing: -0.02em;
    }

    .sb-empty p {
      margin: 0;
    }

    .sb-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--story-border);
      border-radius: 16px;
      background: var(--story-surface);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }

    .sb-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.88rem;
    }

    .sb-table th,
    .sb-table td {
      padding: 0.7rem 0.8rem;
      text-align: left;
      border-bottom: 1px solid var(--story-border);
      vertical-align: middle;
    }

    .sb-table th {
      background: #f8fafc;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--story-text-muted);
    }

    .sb-table tbody tr:hover {
      background: #f8fafc;
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
      color: #0f172a;
      font-weight: 600;
      text-decoration: none;
    }

    .sb-link:hover {
      color: var(--story-primary);
      text-decoration: underline;
    }

    .sb-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.4rem;
      white-space: nowrap;
    }

    .sb-min-input {
      width: 5.25rem;
      min-height: 2.2rem;
      padding: 0.35rem 0.45rem;
      text-align: right;
      border: 1px solid var(--story-border-strong);
      border-radius: 9px;
      background: #ffffff;
      color: #0f172a;
      font: inherit;
      font-variant-numeric: tabular-nums;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .sb-min-input:focus {
      outline: none;
      border-color: var(--story-primary);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .sb-btn {
      min-height: 2.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 0.75rem;
      font-size: 0.82rem;
      font-weight: 600;
      border: 1px solid var(--story-border-strong);
      border-radius: 9px;
      background: #ffffff;
      color: var(--story-primary);
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .sb-btn:hover:not(:disabled) {
      border-color: var(--story-primary);
      background: rgba(30, 64, 175, 0.06);
    }

    .sb-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .sb-btn-primary {
      border-color: var(--story-primary);
      background: var(--story-primary);
      color: var(--story-on-primary);
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.22);
    }

    .sb-btn-primary:hover:not(:disabled) {
      background: var(--story-primary-hover);
      border-color: var(--story-primary-hover);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.28);
    }

    .sb-dialog {
      border: none;
      border-radius: 16px;
      padding: 0;
      max-width: min(100%, 420px);
      box-shadow: 0 25px 50px rgba(15, 23, 42, 0.2);
    }

    .sb-dialog::backdrop {
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
    }

    .sb-dialog-inner {
      padding: 1.35rem 1.5rem 1.25rem;
    }

    .sb-dialog-title {
      margin: 0 0 0.35rem;
      font-size: 1.15rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.02em;
    }

    .sb-dialog-name {
      margin: 0 0 0.85rem;
      font-size: 0.88rem;
      color: var(--story-text-muted);
    }

    .sb-dialog-close {
      margin-top: 1rem;
      min-height: 2.35rem;
      padding: 0 0.95rem;
      font: inherit;
      font-size: 0.86rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 10px;
      background: #ffffff;
      cursor: pointer;
      color: var(--story-text);
    }

    .sb-dialog-close:hover {
      background: #f8fafc;
    }

    @media (max-width: 760px) {
      .sb-header {
        align-items: flex-start;
      }

      .sb-hero-icon {
        display: none;
      }

      .sb-actions {
        flex-wrap: wrap;
      }
    }
  `,
})
export class StockBajoMinimoComponent implements OnInit {
  protected readonly formatProductoCategorias = formatProductoCategorias;

  private readonly api = inject(CatalogoApiService);
  private readonly auth = inject(AuthService);
  private readonly movDialogRef = viewChild<ElementRef<HTMLDialogElement>>('movDialog');

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly rows = signal<ProductoDto[]>([]);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  protected readonly categoriaFiltro = signal<number | null>(null);
  protected readonly movProducto = signal<ProductoDto | null>(null);
  protected readonly stockMinimoDrafts = signal<Record<number, string>>({});
  protected readonly savingStockMinimoId = signal<number | null>(null);

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

  protected canEditStockMinimo(): boolean {
    return this.auth.currentUser()?.companyRole === 'company_admin';
  }

  protected deficit(p: ProductoDto): number {
    const min = p.stockMinimo;
    if (min == null) return 0;
    return Math.max(0, min - p.cantidad);
  }

  protected deficitTotal(): number {
    return this.rows().reduce((sum, p) => sum + this.deficit(p), 0);
  }

  protected categoriaActivaLabel(): string {
    const id = this.categoriaFiltro();
    if (id == null) return 'Todas';
    return this.categorias().find((c) => c.id === id)?.nombre ?? 'Filtrada';
  }

  protected stockMinimoDraftValue(p: ProductoDto): string {
    return this.stockMinimoDrafts()[p.id] ?? (p.stockMinimo == null ? '' : String(p.stockMinimo));
  }

  protected onStockMinimoDraft(productoId: number, ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this.stockMinimoDrafts.update((drafts) => ({ ...drafts, [productoId]: value }));
  }

  protected stockMinimoChanged(p: ProductoDto): boolean {
    return this.stockMinimoDraftValue(p).trim() !== (p.stockMinimo == null ? '' : String(p.stockMinimo));
  }

  protected guardarStockMinimo(p: ProductoDto): void {
    const raw = this.stockMinimoDraftValue(p).trim();
    const stockMinimo = raw === '' ? null : Number(raw);
    if (stockMinimo != null && (!Number.isFinite(stockMinimo) || stockMinimo < 0)) {
      this.error.set('El stock mínimo debe ser un número entero mayor o igual que 0.');
      return;
    }
    this.error.set('');
    this.savingStockMinimoId.set(p.id);
    this.api.updateProductoStockMinimo(p.id, stockMinimo == null ? null : Math.floor(stockMinimo)).subscribe({
      next: () => {
        this.savingStockMinimoId.set(null);
        this.recargar();
      },
      error: (err: { error?: { message?: string } }) => {
        this.savingStockMinimoId.set(null);
        const msg = err?.error?.message;
        this.error.set(typeof msg === 'string' ? msg : 'No se pudo guardar el stock mínimo');
      },
    });
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
        this.stockMinimoDrafts.set({});
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
