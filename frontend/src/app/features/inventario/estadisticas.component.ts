import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InventarioEstadisticasDto, CategoriaDto } from '../../core/models/catalogo.models';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="stats-page">
      <header class="stats-head">
        <h1>Estadísticas de inventario</h1>
        <p class="stats-intro">
          Resumen de <strong>entradas</strong>, <strong>salidas</strong> y <strong>ajustes</strong> registrados al crear
          productos o al cambiar la cantidad en stock. Las fechas se interpretan en <strong>UTC</strong> (coinciden
          con el día guardado en el servidor).
        </p>
      </header>

      <section class="stats-filters" aria-labelledby="filtros-stats">
        <h2 id="filtros-stats" class="sr-only">Filtros</h2>
        <div class="filters-row">
          <label>
            Desde
            <input type="date" [value]="desdeStr()" (change)="onDesde($event)" />
          </label>
          <label>
            Hasta
            <input type="date" [value]="hastaStr()" (change)="onHasta($event)" />
          </label>
          <label class="stats-cat-filter">
            Categoría
            <select
              class="stats-cat-select"
              [value]="categoriaFiltro() != null ? '' + categoriaFiltro() : ''"
              (change)="onCategoriaFiltroChange($event)"
            >
              <option value="">Todas</option>
              @for (c of categorias(); track c.id) {
                <option [value]="'' + c.id">{{ c.nombre }}</option>
              }
            </select>
          </label>
          <button type="button" class="btn-apply" (click)="cargar()" [disabled]="loading()">
            {{ loading() ? 'Cargando…' : 'Actualizar' }}
          </button>
        </div>
        @if (loading() && !data()) {
          <p class="stats-muted stats-loading">Cargando datos del periodo…</p>
        }
      </section>

      @if (data(); as d) {
        <section class="kpi-row" aria-label="Totales del periodo">
          <article class="kpi">
            <span class="kpi-label">Movimientos</span>
            <span class="kpi-value">{{ d.totalMovimientos }}</span>
          </article>
          <article class="kpi kpi-entrada">
            <span class="kpi-label">Unidades entrada</span>
            <span class="kpi-value">{{ d.unidadesEntrada }}</span>
          </article>
          <article class="kpi kpi-salida">
            <span class="kpi-label">Unidades salida</span>
            <span class="kpi-value">{{ d.unidadesSalida }}</span>
          </article>
          <article class="kpi kpi-ajuste">
            <span class="kpi-label">Unidades ajuste</span>
            <span class="kpi-value">{{ d.unidadesAjuste }}</span>
          </article>
        </section>

        <section class="stats-block" aria-labelledby="serie-title">
          <h2 id="serie-title">Salidas y entradas por día</h2>
          @if (d.seriePorDia.length === 0) {
            <p class="stats-muted">No hay movimientos en este rango.</p>
          } @else {
            <div class="table-wrap">
              <table class="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Fecha (UTC)</th>
                    <th scope="col">Entradas</th>
                    <th scope="col">Salidas</th>
                    <th scope="col">Ajustes</th>
                    <th scope="col" class="col-bar">Salidas (gráfico)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of d.seriePorDia; track row.fecha) {
                    <tr>
                      <td>{{ row.fecha }}</td>
                      <td>{{ row.entradasUnidades }}</td>
                      <td>{{ row.salidasUnidades }}</td>
                      <td>{{ row.ajustesUnidades }}</td>
                      <td class="col-bar">
                        <span
                          class="bar-salida"
                          [style.width.%]="pctSalida(row.salidasUnidades)"
                          [title]="row.salidasUnidades + ' uds.'"
                        ></span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="stats-block" aria-labelledby="top-title">
          <h2 id="top-title">Productos con más salidas de stock</h2>
          @if (d.topSalidasProducto.length === 0) {
            <p class="stats-muted">No hubo salidas en el periodo.</p>
          } @else {
            <ol class="top-list">
              @for (t of d.topSalidasProducto; track t.productoId) {
                <li>
                  <a [routerLink]="['/producto', t.productoId]" class="top-link">{{ t.nombreProducto }}</a>
                  <span class="top-qty">{{ t.unidadesSalida }} uds.</span>
                </li>
              }
            </ol>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .stats-page {
      max-width: 56rem;
      margin: 0 auto;
      padding-bottom: 2rem;
    }

    .stats-head h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--story-text);
    }

    .stats-intro {
      margin: 0 0 1.25rem;
      font-size: 0.95rem;
      line-height: 1.6;
      color: var(--story-text-muted);
    }

    .stats-intro strong {
      color: var(--story-text);
    }

    .stats-filters {
      margin-bottom: 1.25rem;
      padding: 1rem 1.15rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 12px;
    }

    .filters-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 1rem;
    }

    .filters-row label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--story-text);
    }

    .filters-row input[type='date'] {
      padding: 0.45rem 0.5rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 8px;
      font: inherit;
    }

    .btn-apply {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      background: var(--story-primary);
      color: var(--story-on-primary);
      font-weight: 600;
      cursor: pointer;
    }

    .btn-apply:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .stats-error {
      margin: 0.75rem 0 0;
      color: var(--story-danger);
      font-size: 0.9rem;
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.5rem;
    }

    .kpi {
      padding: 1rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 12px;
    }

    .kpi-entrada {
      border-left: 4px solid #15803d;
    }

    .kpi-salida {
      border-left: 4px solid #b45309;
    }

    .kpi-ajuste {
      border-left: 4px solid #64748b;
    }

    .kpi-label {
      display: block;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--story-text-muted);
      margin-bottom: 0.35rem;
    }

    .kpi-value {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--story-text);
    }

    .stats-block {
      margin-bottom: 1.5rem;
      padding: 1.15rem 1.25rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 12px;
    }

    .stats-block h2 {
      margin: 0 0 0.85rem;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--story-text);
    }

    .stats-muted {
      margin: 0;
      color: var(--story-text-muted);
      font-size: 0.95rem;
    }

    .stats-loading {
      margin-top: 0.75rem;
    }

    .table-wrap {
      overflow-x: auto;
    }

    .stats-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .stats-table th,
    .stats-table td {
      padding: 0.5rem 0.65rem;
      text-align: left;
      border-bottom: 1px solid var(--story-border);
    }

    .stats-table th {
      font-weight: 600;
      color: var(--story-text-muted);
      background: #f8fafc;
    }

    .col-bar {
      min-width: 8rem;
      vertical-align: middle;
      position: relative;
    }

    .bar-salida {
      display: block;
      height: 0.55rem;
      border-radius: 4px;
      background: linear-gradient(90deg, #ea580c, #f59e0b);
      min-width: 2px;
      max-width: 100%;
    }

    .top-list {
      margin: 0;
      padding-left: 1.2rem;
    }

    .top-list li {
      margin-bottom: 0.45rem;
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.5rem 1rem;
    }

    .top-link {
      font-weight: 600;
    }

    .top-qty {
      font-size: 0.9rem;
      color: var(--story-text-muted);
    }

    .stats-cat-filter {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--story-text-muted);
    }

    .stats-cat-select {
      min-width: 10rem;
      padding: 0.45rem 0.65rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 8px;
      background: var(--story-surface);
      font: inherit;
      font-weight: 500;
      color: var(--story-text);
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `,
})
export class EstadisticasComponent implements OnInit {
  private readonly api = inject(CatalogoApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly maxSalidasEnSerie = signal(1);

  protected readonly desdeStr = signal(EstadisticasComponent.defaultDesde());
  protected readonly hastaStr = signal(EstadisticasComponent.defaultHasta());
  protected readonly categoriaFiltro = signal<number | null>(null);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  protected readonly data = signal<InventarioEstadisticasDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getCategorias().subscribe({
      next: (list) => this.categorias.set(list),
      error: () => this.categorias.set([]),
    });
    this.cargar();
  }

  private static defaultHasta(): string {
    return EstadisticasComponent.toYmdUtc(new Date());
  }

  /** Ventana de 30 días inclusive aproximada (29 días hacia atrás desde hoy). */
  private static defaultDesde(): string {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - 29 * 86400000);
    return EstadisticasComponent.toYmdUtc(desde);
  }

  private static toYmdUtc(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  protected onDesde(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v) this.desdeStr.set(v);
  }

  protected onHasta(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v) this.hastaStr.set(v);
  }

  protected onCategoriaFiltroChange(ev: Event): void {
    const raw = (ev.target as HTMLSelectElement).value;
    if (raw === '') {
      this.categoriaFiltro.set(null);
      return;
    }
    const id = Number(raw);
    this.categoriaFiltro.set(Number.isFinite(id) ? id : null);
  }

  protected cargar(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.api
      .getInventarioEstadisticas(this.desdeStr(), this.hastaStr(), this.categoriaFiltro())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.data.set(d);
          const max = d.seriePorDia.length
            ? Math.max(1, ...d.seriePorDia.map((s) => s.salidasUnidades))
            : 1;
          this.maxSalidasEnSerie.set(max);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errorMsg.set('No se pudieron cargar las estadísticas. Revisa la sesión y el rango de fechas.');
        },
      });
  }

  protected pctSalida(unidades: number): number {
    return (unidades / this.maxSalidasEnSerie()) * 100;
  }
}
