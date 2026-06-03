import {
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import ExcelJS from 'exceljs';
import { CategoriaDto, ProductoDto, formatProductoCategorias } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';
import { esStockBajo } from '../../core/utils/catalogo.util';
import {
  canEditFullProduct as checkCanEditFullProduct,
  canEditProduct as checkCanEditProduct,
} from '../../core/utils/company-role.util';
import {
  GuardarArchivoOpciones,
  guardarArchivoConDialogo,
} from '../../core/utils/save-file.util';
import { closeDialogOnBackdropClick } from '../../core/utils/dialog.util';
import { RegistrarMovimientoComponent } from './registrar-movimiento.component';

/** Valores separados por tabulador: Excel abre cada campo en su columna (A1, B1, C1…). */
function escapeTsvCell(value: string): string {
  return value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

/** Paleta compartida exportación stock (Excel + PDF). */
const STOCK_EXPORT_COLORS = {
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
} as const;

function hexToArgb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [RouterLink, RegistrarMovimientoComponent],
  template: `
    <div class="sb-page">
      <section class="sb-summary" aria-label="Resumen de stock">
        <article class="sb-summary-card">
          <span class="summary-icon summary-icon--blue" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
            </svg>
          </span>
          <div>
            <span class="summary-label">Productos</span>
            <strong class="summary-value">{{ rows().length }}</strong>
          </div>
        </article>
        <article class="sb-summary-card">
          <span class="summary-icon summary-icon--red" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </span>
          <div>
            <span class="summary-label">Bajo mínimo</span>
            <strong class="summary-value">{{ alertasEnVista() }}</strong>
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
      </section>

      <div class="sb-toolbar">
        <div class="sb-view-toggle" role="group" aria-label="Vista de stock">
          <button
            type="button"
            class="sb-view-btn"
            [class.sb-view-btn--active]="!soloBajoMinimo()"
            [attr.aria-pressed]="!soloBajoMinimo()"
            (click)="setSoloBajoMinimo(false)"
          >
            Todos
          </button>
          <button
            type="button"
            class="sb-view-btn"
            [class.sb-view-btn--active]="soloBajoMinimo()"
            [attr.aria-pressed]="soloBajoMinimo()"
            (click)="setSoloBajoMinimo(true)"
          >
            Solo bajo mínimo
          </button>
        </div>
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
        <div class="sb-export">
          <button type="button" class="sb-btn sb-btn-export" (click)="exportarCsvPlano()" [disabled]="rows().length === 0">
            CSV
          </button>
          <button type="button" class="sb-btn sb-btn-export" (click)="exportarCsv()" [disabled]="rows().length === 0">
            Excel
          </button>
          <button type="button" class="sb-btn sb-btn-export" (click)="exportarPdf()" [disabled]="rows().length === 0">
            PDF
          </button>
        </div>
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
              @if (soloBajoMinimo()) {
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
              } @else {
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7" />
              }
            </svg>
          </span>
          @if (soloBajoMinimo()) {
            <h2>Todo bajo control</h2>
            <p>No hay productos bajo el stock mínimo con los filtros actuales.</p>
          } @else {
            <h2>Sin productos</h2>
            <p>No hay productos que coincidan con el filtro de categoría.</p>
          }
        </div>
      } @else {
        <div class="sb-table-wrap">
          <table class="sb-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Carpeta</th>
                <th class="num">Stock</th>
                <th class="num">Mínimo</th>
                <th class="num">Déficit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (p of rows(); track p.id) {
                <tr [class.sb-row--warn]="esStockBajo(p)">
                  <td>
                    <a [routerLink]="['/producto', p.id]" class="sb-link" [class.stock-bajo]="esStockBajo(p)">{{ p.nombre }}</a>
                  </td>
                  <td>{{ formatProductoCategorias(p) }}</td>
                  <td>{{ p.carpetaNombre ?? 'Raíz' }}</td>
                  <td class="num" [class.stock-bajo]="esStockBajo(p)">{{ p.cantidad }}</td>
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

      @if (canRegistrarMovimiento()) {
        <dialog #movDialog class="pd-mov-dialog" (click)="closeDialogOnBackdropClick($event, cerrarMovimiento.bind(this))">
          @if (movProducto(); as pr) {
            <div class="pd-mov-dialog-inner">
              <div class="modal-head-bar">
                <div class="modal-head-bar__main">
                  <h2 id="pd-mov-dialog-title" class="pd-mov-dialog-title">Registrar movimiento</h2>
                  <p class="pd-mov-dialog-sub">{{ pr.nombre }} - stock actual {{ pr.cantidad }}</p>
                </div>
                <button type="button" class="modal-close" aria-label="Cerrar" (click)="cerrarMovimiento()">
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <app-registrar-movimiento [producto]="pr" (completado)="onMovimientoHecho()" />
            </div>
          }
        </dialog>
      }
    </div>
  `,
  styles: `
    :host {
      --pd-card: var(--story-surface, #ffffff);
      --pd-border: var(--story-border, #e2e8f0);
      --pd-muted: var(--story-text-muted, #64748b);
      --pd-text: var(--story-text, #1e293b);
      --pd-primary: var(--story-primary, #1e40af);
    }

    .sb-page {
      max-width: 72rem;
      margin: 0 auto;
      padding: 0.5rem 1rem 3rem;
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

    .summary-icon--blue {
      background: rgba(30, 64, 175, 0.1);
      color: var(--story-primary);
    }

    .summary-icon--red {
      background: rgba(185, 28, 28, 0.09);
      color: var(--story-danger);
    }

    .summary-icon--amber {
      background: rgba(245, 158, 11, 0.14);
      color: var(--story-accent-muted);
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

    .sb-toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
      padding: 0.75rem 0.85rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }

    .sb-view-toggle {
      display: inline-flex;
      padding: 0.2rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 10px;
      background: #f8fafc;
    }

    .sb-view-btn {
      border: none;
      border-radius: 8px;
      background: transparent;
      padding: 0.45rem 0.75rem;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    }

    .sb-view-btn:hover {
      color: #0f172a;
    }

    .sb-view-btn--active {
      background: #ffffff;
      color: var(--story-primary);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
    }

    .sb-filter {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-width: 14rem;
      flex: 1 1 12rem;
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
    }

    .sb-select:focus {
      outline: none;
      border-color: var(--story-primary);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .sb-export {
      display: flex;
      gap: 0.45rem;
      margin-left: auto;
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
    }

    .sb-empty {
      text-align: center;
      padding: 2.25rem 1.5rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 18px;
    }

    .empty-icon {
      width: 4rem;
      height: 4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 18px;
      background: rgba(21, 128, 61, 0.1);
      color: var(--story-success);
      margin-bottom: 0.8rem;
    }

    .sb-empty h2 {
      margin: 0 0 0.35rem;
      color: #0f172a;
      font-size: 1.35rem;
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

    .sb-row--warn {
      background: rgba(185, 28, 28, 0.04);
    }

    .sb-row--warn .sb-deficit {
      font-weight: 700;
      color: var(--story-danger);
    }

    .stock-bajo {
      color: var(--story-danger);
      font-weight: 700;
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
      font: inherit;
      font-variant-numeric: tabular-nums;
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
    }

    .sb-btn:hover:not(:disabled) {
      border-color: var(--story-primary);
      background: rgba(30, 64, 175, 0.06);
    }

    .sb-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .sb-btn-export {
      min-width: 3.5rem;
    }

    .sb-btn-primary {
      border-color: var(--story-primary);
      background: var(--story-primary);
      color: var(--story-on-primary);
    }

    .pd-mov-dialog {
      border: none;
      border-radius: 16px;
      padding: 0;
      max-width: min(100%, 440px);
      width: calc(100% - 2rem);
      box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
    }

    .pd-mov-dialog::backdrop {
      background: rgb(15 23 42 / 0.45);
    }

    .pd-mov-dialog-inner {
      padding: 1.35rem 1.5rem 1.25rem;
    }

    .pd-mov-dialog-title {
      margin: 0 0 0.35rem;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--pd-text);
    }

    .pd-mov-dialog-sub {
      margin: 0 0 0.4rem;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--pd-primary);
    }

    @media (max-width: 760px) {
      .sb-toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .sb-export {
        margin-left: 0;
        justify-content: stretch;
      }

      .sb-export .sb-btn {
        flex: 1;
      }

      .sb-actions {
        flex-wrap: wrap;
      }
    }
  `,
})
export class StockComponent implements OnInit {
  protected readonly closeDialogOnBackdropClick = closeDialogOnBackdropClick;
  protected readonly formatProductoCategorias = formatProductoCategorias;
  protected readonly esStockBajo = esStockBajo;

  private readonly api = inject(CatalogoApiService);
  private readonly auth = inject(AuthService);
  private readonly movDialogRef = viewChild<ElementRef<HTMLDialogElement>>('movDialog');

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly allProducts = signal<ProductoDto[]>([]);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  protected readonly categoriaFiltro = signal<number | null>(null);
  protected readonly soloBajoMinimo = signal(false);
  protected readonly movProducto = signal<ProductoDto | null>(null);
  protected readonly stockMinimoDrafts = signal<Record<number, string>>({});
  protected readonly savingStockMinimoId = signal<number | null>(null);

  protected readonly rows = computed(() => {
    const catId = this.categoriaFiltro();
    let list = this.allProducts();
    if (catId != null) {
      list = list.filter((p) => p.categorias?.some((c) => c.id === catId) ?? false);
    }
    if (this.soloBajoMinimo()) {
      list = list.filter((p) => this.esStockBajo(p));
    }
    return [...list].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  protected readonly alertasEnVista = computed(
    () => this.rows().filter((p) => this.esStockBajo(p)).length,
  );

  ngOnInit(): void {
    this.api.getCategorias().subscribe({
      next: (list) => this.categorias.set(list),
      error: () => this.categorias.set([]),
    });
    this.recargar();
  }

  protected setSoloBajoMinimo(value: boolean): void {
    this.soloBajoMinimo.set(value);
  }

  protected canRegistrarMovimiento(): boolean {
    return checkCanEditProduct(this.auth.currentUser()?.companyRole);
  }

  protected canEditStockMinimo(): boolean {
    return checkCanEditFullProduct(this.auth.currentUser()?.companyRole);
  }

  protected deficit(p: ProductoDto): number {
    const min = p.stockMinimo;
    if (min == null) {
      return 0;
    }
    return Math.max(0, min - p.cantidad);
  }

  protected deficitTotal(): number {
    return this.rows().reduce((sum, p) => sum + this.deficit(p), 0);
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
  }

  protected exportarCsv(): void {
    void this.exportarExcel();
  }

  private async exportarExcel(): Promise<void> {
    const productos = this.rows();
    if (productos.length === 0) {
      return;
    }

    const titulo = this.soloBajoMinimo()
      ? 'StoRy — Stock bajo mínimo'
      : 'StoRy — Inventario de stock';
    const meta = `Generado ${new Date().toLocaleString('es')} · ${productos.length} productos`;

    const ARGB = {
      primary: hexToArgb(STOCK_EXPORT_COLORS.primary),
      primaryBorder: hexToArgb(STOCK_EXPORT_COLORS.primaryBorder),
      text: hexToArgb(STOCK_EXPORT_COLORS.text),
      muted: hexToArgb(STOCK_EXPORT_COLORS.muted),
      meta: hexToArgb(STOCK_EXPORT_COLORS.meta),
      white: hexToArgb(STOCK_EXPORT_COLORS.white),
      rowAlt: hexToArgb(STOCK_EXPORT_COLORS.rowAlt),
      warnBg: hexToArgb(STOCK_EXPORT_COLORS.warnBg),
      warn: hexToArgb(STOCK_EXPORT_COLORS.warn),
      border: hexToArgb(STOCK_EXPORT_COLORS.border),
    } as const;

    const solidFill = (argb: string): ExcelJS.Fill => ({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb },
    });

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: ARGB.border } },
      left: { style: 'thin', color: { argb: ARGB.border } },
      bottom: { style: 'thin', color: { argb: ARGB.border } },
      right: { style: 'thin', color: { argb: ARGB.border } },
    };

    const headerBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: ARGB.primaryBorder } },
      left: { style: 'thin', color: { argb: ARGB.primaryBorder } },
      bottom: { style: 'thin', color: { argb: ARGB.primaryBorder } },
      right: { style: 'thin', color: { argb: ARGB.primaryBorder } },
    };

    const saveOpts: GuardarArchivoOpciones = {
      suggestedName: `stock-${this.fechaExport()}.xlsx`,
      description: 'Libro de Excel',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    };

    try {
      await this.guardarExport(async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'StoRy';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Stock', {
        views: [{ state: 'frozen', ySplit: 4 }],
        properties: { defaultRowHeight: 20 },
      });

      sheet.mergeCells('A1:G1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = titulo;
      titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: ARGB.primary } };
      titleCell.alignment = { vertical: 'middle' };
      sheet.getRow(1).height = 26;

      sheet.mergeCells('A2:G2');
      const metaCell = sheet.getCell('A2');
      metaCell.value = meta;
      metaCell.font = { name: 'Calibri', size: 10, color: { argb: ARGB.meta } };
      metaCell.alignment = { vertical: 'middle' };
      sheet.getRow(2).height = 18;

      sheet.getRow(3).height = 8;

      const headerRow = sheet.getRow(4);
      headerRow.values = [
        'Producto',
        'Código',
        'Categorías',
        'Carpeta',
        'Stock',
        'Mínimo',
        'Déficit',
      ];
      headerRow.height = 22;
      headerRow.eachCell((cell, col) => {
        cell.fill = solidFill(ARGB.primary);
        cell.font = {
          name: 'Calibri',
          bold: true,
          size: 11,
          color: { argb: ARGB.white },
        };
        cell.border = headerBorder;
        cell.alignment = {
          vertical: 'middle',
          horizontal: col >= 5 ? 'right' : 'left',
        };
      });

      productos.forEach((p, idx) => {
        const bajo = this.esStockBajo(p);
        const deficit = this.deficit(p);
        const rowFill = solidFill(bajo ? ARGB.warnBg : idx % 2 === 0 ? ARGB.white : ARGB.rowAlt);

        const row = sheet.addRow([
          p.nombre,
          p.codigo,
          formatProductoCategorias(p),
          p.carpetaNombre ?? 'Raíz',
          p.cantidad,
          p.stockMinimo ?? '—',
          deficit,
        ]);

        row.eachCell((cell, col) => {
          cell.fill = rowFill;
          cell.border = thinBorder;
          cell.alignment = {
            vertical: 'middle',
            horizontal: col >= 5 ? 'right' : 'left',
            wrapText: col <= 3,
          };

          if (col === 1) {
            cell.font = {
              name: 'Calibri',
              bold: true,
              color: { argb: bajo ? ARGB.warn : ARGB.text },
            };
          } else if (col === 2) {
            cell.font = { name: 'Calibri', color: { argb: ARGB.muted } };
          } else if (col === 5 && bajo) {
            cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.warn } };
          } else if (col === 7 && deficit > 0) {
            cell.font = { name: 'Calibri', bold: true, color: { argb: ARGB.warn } };
          } else {
            cell.font = { name: 'Calibri', color: { argb: ARGB.text } };
          }
        });
      });

      sheet.columns = [
        { width: 28 },
        { width: 36 },
        { width: 22 },
        { width: 16 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
      ];

      const lastRow = sheet.rowCount;
      sheet.autoFilter = { from: 'A4', to: `G${lastRow}` };

      const buffer = await workbook.xlsx.writeBuffer();
      return new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      }, saveOpts);
    } catch {
      this.error.set('No se pudo generar el archivo Excel.');
    }
  }

  protected exportarCsvPlano(): void {
    void this.exportarCsvPlanoArchivo();
  }

  private async exportarCsvPlanoArchivo(): Promise<void> {
    if (this.rows().length === 0) {
      return;
    }

    await this.guardarExport(() => {
      const sep = '\t';
      const headers = ['Producto', 'Código', 'Categorías', 'Carpeta', 'Stock', 'Mínimo', 'Déficit'];
      const lines = [headers.map(escapeTsvCell).join(sep)];
      for (const p of this.rows()) {
        lines.push(
          [
            p.nombre,
            p.codigo,
            formatProductoCategorias(p),
            p.carpetaNombre ?? 'Raíz',
            String(p.cantidad),
            p.stockMinimo == null ? '' : String(p.stockMinimo),
            String(this.deficit(p)),
          ]
            .map(escapeTsvCell)
            .join(sep),
        );
      }
      return new Blob(['\ufeff', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    }, {
      suggestedName: `stock-${this.fechaExport()}.csv`,
      description: 'CSV (valores separados)',
      mimeType: 'text/csv',
      extension: 'csv',
    });
  }

  protected exportarPdf(): void {
    void this.exportarPdfArchivo();
  }

  private async exportarPdfArchivo(): Promise<void> {
    const productos = this.rows();
    if (productos.length === 0) {
      return;
    }

    const titulo = this.soloBajoMinimo()
      ? 'StoRy — Stock bajo mínimo'
      : 'StoRy — Inventario de stock';
    const meta = `Generado ${new Date().toLocaleString('es')} · ${productos.length} productos`;

    const primaryRgb = hexToRgb(STOCK_EXPORT_COLORS.primary);
    const primaryBorderRgb = hexToRgb(STOCK_EXPORT_COLORS.primaryBorder);
    const textRgb = hexToRgb(STOCK_EXPORT_COLORS.text);
    const mutedRgb = hexToRgb(STOCK_EXPORT_COLORS.muted);
    const metaRgb = hexToRgb(STOCK_EXPORT_COLORS.meta);
    const whiteRgb = hexToRgb(STOCK_EXPORT_COLORS.white);
    const rowAltRgb = hexToRgb(STOCK_EXPORT_COLORS.rowAlt);
    const warnBgRgb = hexToRgb(STOCK_EXPORT_COLORS.warnBg);
    const warnRgb = hexToRgb(STOCK_EXPORT_COLORS.warn);
    const borderRgb = hexToRgb(STOCK_EXPORT_COLORS.border);

    const saveOpts: GuardarArchivoOpciones = {
      suggestedName: `stock-${this.fechaExport()}.pdf`,
      description: 'Documento PDF',
      mimeType: 'application/pdf',
      extension: 'pdf',
    };

    try {
      await this.guardarExport(async () => {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...primaryRgb);
      doc.text(titulo, 14, 16);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...metaRgb);
      doc.text(meta, 14, 22);

      autoTable(doc, {
        head: [['Producto', 'Código', 'Categorías', 'Carpeta', 'Stock', 'Mínimo', 'Déficit']],
        body: productos.map((p) => [
          p.nombre,
          p.codigo,
          formatProductoCategorias(p),
          p.carpetaNombre ?? 'Raíz',
          String(p.cantidad),
          p.stockMinimo == null ? '—' : String(p.stockMinimo),
          String(this.deficit(p)),
        ]),
        startY: 28,
        margin: { left: 14, right: 14 },
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 2.5,
          textColor: textRgb,
          lineColor: borderRgb,
          lineWidth: 0.1,
          valign: 'middle',
        },
        headStyles: {
          fillColor: primaryRgb,
          textColor: whiteRgb,
          fontStyle: 'bold',
          lineColor: primaryBorderRgb,
        },
        columnStyles: {
          0: { cellWidth: 48 },
          1: { cellWidth: 52 },
          2: { cellWidth: 36 },
          3: { cellWidth: 28 },
          4: { halign: 'right', cellWidth: 18 },
          5: { halign: 'right', cellWidth: 18 },
          6: { halign: 'right', cellWidth: 18 },
        },
        didParseCell: (data) => {
          if (data.section !== 'body') {
            return;
          }
          const p = productos[data.row.index];
          const bajo = this.esStockBajo(p);
          const deficit = this.deficit(p);
          const idx = data.row.index;
          data.cell.styles.fillColor = bajo ? warnBgRgb : idx % 2 === 0 ? whiteRgb : rowAltRgb;

          if (data.column.index === 0) {
            data.cell.styles.fontStyle = 'bold';
            if (bajo) {
              data.cell.styles.textColor = warnRgb;
            }
          } else if (data.column.index === 1) {
            data.cell.styles.textColor = mutedRgb;
          } else if (data.column.index === 4 && bajo) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = warnRgb;
          } else if (data.column.index === 6 && deficit > 0) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = warnRgb;
          }
        },
      });

      return doc.output('blob');
      }, saveOpts);
    } catch {
      this.error.set('No se pudo generar el PDF.');
    }
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
    this.api.getTodosProductosEmpresa().subscribe({
      next: (list) => {
        this.allProducts.set(list);
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

  private fechaExport(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async guardarExport(
    crearBlob: () => Promise<Blob> | Blob,
    opciones: GuardarArchivoOpciones,
  ): Promise<void> {
    const resultado = await guardarArchivoConDialogo(crearBlob, opciones);
    if (resultado.ok || resultado.reason === 'cancelled') {
      return;
    }
    if (resultado.reason === 'unsupported') {
      this.error.set(
        'Tu navegador no permite elegir dónde guardar. Usa Chrome o Edge actualizado en HTTPS o localhost.',
      );
      return;
    }
    this.error.set('No se pudo guardar el archivo.');
  }

}
