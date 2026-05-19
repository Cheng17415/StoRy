import { CurrencyPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { InventarioEstadisticasDto, CarpetaArbolDto, CategoriaDto } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';

interface CarpetaOpcion {
  id: number;
  nombre: string;
  depth: number;
}

function flattenCarpetas(nodes: CarpetaArbolDto[], depth = 0): CarpetaOpcion[] {
  const out: CarpetaOpcion[] = [];
  for (const n of nodes) {
    out.push({ id: n.id, nombre: n.nombre, depth });
    out.push(...flattenCarpetas(n.hijos, depth + 1));
  }
  return out;
}

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [RouterLink, CurrencyPipe],
  template: `
    <div class="stats-page">
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
          <button type="button" class="btn-apply" (click)="cargar()" [disabled]="loading()">
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span>
              Cargando…
            } @else {
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M3 16v5h5M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 8V3h-5" />
              </svg>
              Actualizar
            }
          </button>
        </div>
        <div class="filters-multi" aria-label="Filtros por carpeta y categoría">
          <div class="filter-panel">
            <div class="filter-panel-head">
              <span class="filter-panel-title">Carpetas</span>
              @if (carpetasSeleccionadas().length > 0) {
                <button type="button" class="filter-clear" (click)="limpiarCarpetas()">Quitar todas</button>
              }
            </div>
            @if (carpetasOpciones().length === 0) {
              <p class="stats-muted filter-empty">No hay carpetas.</p>
            } @else {
              <ul class="filter-checklist">
                @for (c of carpetasOpciones(); track c.id) {
                  <li [style.padding-left.rem]="0.35 + c.depth * 0.85">
                    <label class="filter-check">
                      <input
                        type="checkbox"
                        [checked]="carpetaSeleccionada(c.id)"
                        (change)="onCarpetaCheck(c.id, $event)"
                      />
                      <span>{{ c.nombre }}</span>
                    </label>
                  </li>
                }
              </ul>
            }
          </div>
          <div class="filter-panel">
            <div class="filter-panel-head">
              <span class="filter-panel-title">Categorías</span>
              @if (categoriasSeleccionadas().length > 0) {
                <button type="button" class="filter-clear" (click)="limpiarCategorias()">Quitar todas</button>
              }
            </div>
            @if (categorias().length === 0) {
              <p class="stats-muted filter-empty">No hay categorías.</p>
            } @else {
              <ul class="filter-checklist">
                @for (c of categorias(); track c.id) {
                  <li>
                    <label class="filter-check">
                      <input
                        type="checkbox"
                        [checked]="categoriaSeleccionada(c.id)"
                        (change)="onCategoriaCheck(c.id, $event)"
                      />
                      <span>{{ c.nombre }}</span>
                    </label>
                  </li>
                }
              </ul>
            }
          </div>
        </div>
        @if (errorMsg()) {
          <p class="stats-error" role="alert">{{ errorMsg() }}</p>
        }
        @if (loading() && !data()) {
          <p class="stats-muted stats-loading">Cargando datos del periodo…</p>
        }
      </section>

      @if (data(); as d) {
        <section class="kpi-row kpi-row--primary" aria-label="Estado actual del inventario">
          <article class="kpi">
            <span class="kpi-icon kpi-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
              </svg>
            </span>
            <div>
              <span class="kpi-label">Productos</span>
              <span class="kpi-value">{{ d.totalProductos }}</span>
            </div>
          </article>
          <article class="kpi">
            <span class="kpi-icon kpi-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            <div>
              <span class="kpi-label">Valor inventario</span>
              <span class="kpi-value">{{ d.valorInventarioTotal | currency: companyCurrency() }}</span>
            </div>
          </article>
          <article class="kpi">
            <span class="kpi-icon kpi-icon--amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 7h-7L9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
              </svg>
            </span>
            <div>
              <span class="kpi-label">Unidades actuales</span>
              <span class="kpi-value">{{ d.cantidadActualTotal }}</span>
            </div>
          </article>
          <article class="kpi" [class.kpi-danger]="d.productosBajoMinimo > 0">
            <span class="kpi-icon kpi-icon--red" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </span>
            <div>
              <span class="kpi-label">Bajo mínimo</span>
              <span class="kpi-value">{{ d.productosBajoMinimo }}</span>
            </div>
          </article>
        </section>

        <section class="kpi-row" aria-label="Movimiento del periodo">
          <article class="kpi compact">
            <span class="kpi-label">Movimientos</span>
            <span class="kpi-value">{{ d.totalMovimientos }}</span>
          </article>
          <article class="kpi compact">
            <span class="kpi-label">Unidades entrada</span>
            <span class="kpi-value">{{ d.unidadesEntrada }}</span>
          </article>
          <article class="kpi compact">
            <span class="kpi-label">Unidades salida</span>
            <span class="kpi-value">{{ d.unidadesSalida }}</span>
          </article>
          <article class="kpi compact">
            <span class="kpi-label">Balance neto</span>
            <span class="kpi-value" [class.negative]="balanceNeto(d) < 0">{{ balanceNeto(d) }}</span>
          </article>
        </section>

        <div class="stats-layout">
          <section class="stats-block chart-block" aria-labelledby="serie-title">
            <div class="block-head">
              <h2 id="serie-title">Actividad diaria</h2>
              <span class="block-sub">Entradas, salidas y ajustes por día</span>
            </div>
            @if (d.seriePorDia.length === 0) {
              <p class="stats-muted">No hay movimientos en este rango.</p>
            } @else {
              <div class="daily-chart">
                @for (row of d.seriePorDia; track row.fecha) {
                  <div class="day-row">
                    <span class="day-label">{{ row.fecha.slice(5) }}</span>
                    <div class="day-bars" [title]="row.fecha">
                      <span class="day-bar in" [style.width.%]="pctSerie(row.entradasUnidades)" [title]="'Entradas: ' + row.entradasUnidades"></span>
                      <span class="day-bar out" [style.width.%]="pctSerie(row.salidasUnidades)" [title]="'Salidas: ' + row.salidasUnidades"></span>
                      <span class="day-bar adj" [style.width.%]="pctSerie(row.ajustesUnidades)" [title]="'Ajustes: ' + row.ajustesUnidades"></span>
                    </div>
                    <span class="day-total">{{ row.entradasUnidades + row.salidasUnidades + row.ajustesUnidades }}</span>
                  </div>
                }
              </div>
              <div class="legend">
                <span><i class="legend-dot in"></i> Entradas</span>
                <span><i class="legend-dot out"></i> Salidas</span>
                <span><i class="legend-dot adj"></i> Ajustes</span>
              </div>
            }
          </section>

          <section class="stats-block" aria-labelledby="top-title">
            <div class="block-head">
              <h2 id="top-title">Productos más movidos</h2>
              <span class="block-sub">Ranking por salidas</span>
            </div>
            @if (d.topSalidasProducto.length === 0) {
              <p class="stats-muted">No hubo salidas en el periodo.</p>
            } @else {
              <ol class="top-list">
                @for (t of d.topSalidasProducto; track t.productoId; let idx = $index) {
                  <li>
                    <span class="top-rank">{{ idx + 1 }}</span>
                    <a [routerLink]="['/producto', t.productoId]" class="top-link">{{ t.nombreProducto }}</a>
                    <span class="top-qty">{{ t.unidadesSalida }} uds.</span>
                  </li>
                }
              </ol>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .stats-page {
      max-width: 72rem;
      margin: 0 auto;
      padding: 0.5rem 1rem 3rem;
    }

    .stats-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1.5rem;
      margin-bottom: 1rem;
      padding: 1.6rem;
      border: 1px solid var(--story-border);
      border-radius: 20px;
      background:
        radial-gradient(700px 260px at 0% 0%, rgba(59, 130, 246, 0.14), transparent 60%),
        radial-gradient(560px 240px at 100% 120%, rgba(245, 158, 11, 0.14), transparent 65%),
        linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(15, 23, 42, 0.05);
      overflow: hidden;
      position: relative;
    }

    .stats-head::before {
      content: '';
      position: absolute;
      inset: 0 0 auto;
      height: 3px;
      background: linear-gradient(90deg, var(--story-primary), var(--story-secondary), var(--story-accent));
    }

    .stats-head-copy {
      position: relative;
      z-index: 1;
    }

    .eyebrow {
      margin: 0 0 0.25rem;
      color: var(--story-primary);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .stats-head h1 {
      margin: 0;
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      font-weight: 700;
      letter-spacing: -0.035em;
      line-height: 1.05;
      color: #0f172a;
    }

    .stats-intro {
      max-width: 38rem;
      margin: 0.65rem 0 0;
      font-size: 0.98rem;
      line-height: 1.6;
      color: #475569;
    }

    .stats-head-visual {
      position: relative;
      z-index: 1;
      flex: 0 0 11rem;
      height: 7rem;
      padding: 0.8rem;
      border: 1px solid var(--story-border);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.72);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }

    .mini-bars {
      display: flex;
      align-items: flex-end;
      gap: 0.45rem;
      width: 100%;
      height: 100%;
    }

    .mini-bars span {
      flex: 1;
      height: var(--h);
      border-radius: 6px 6px 3px 3px;
      background: linear-gradient(180deg, var(--story-secondary), var(--story-primary));
    }

    .mini-bars .accent {
      background: linear-gradient(180deg, #fbbf24, var(--story-accent));
    }

    .stats-filters {
      margin-bottom: 1rem;
      padding: 0.75rem 0.85rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }

    .filters-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.75rem;
    }

    .filters-row label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--story-text-muted);
    }

    .filters-row input[type='date'],
    .stats-cat-select {
      min-height: 2.5rem;
      padding: 0.55rem 0.75rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 10px;
      background: var(--story-surface);
      color: #0f172a;
      font: inherit;
      font-size: 0.9rem;
      text-transform: none;
      letter-spacing: 0;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .filters-row input[type='date']:focus,
    .stats-cat-select:focus {
      outline: none;
      border-color: var(--story-primary);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .stats-cat-select {
      min-width: 12rem;
      cursor: pointer;
    }

    .btn-apply {
      min-height: 2.5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0 0.95rem;
      border: 1px solid var(--story-primary);
      border-radius: 10px;
      background: var(--story-primary);
      color: var(--story-on-primary);
      font: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.25);
      transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.05s ease;
    }

    .btn-apply:hover:not(:disabled) {
      background: var(--story-primary-hover);
      border-color: var(--story-primary-hover);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.3);
    }

    .btn-apply:active:not(:disabled) {
      transform: translateY(1px);
    }

    .btn-apply:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      box-shadow: none;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .stats-error {
      margin: 0.75rem 0 0;
      padding: 0.65rem 0.75rem;
      color: var(--story-danger);
      background: rgba(185, 28, 28, 0.07);
      border: 1px solid rgba(185, 28, 28, 0.2);
      border-radius: 10px;
      font-size: 0.88rem;
    }

    .kpi-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .filters-multi {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 0.75rem;
      margin-top: 0.85rem;
    }

    .filter-panel {
      padding: 0.65rem 0.75rem;
      border: 1px solid var(--story-border);
      border-radius: 10px;
      background: #f8fafc;
    }

    .filter-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .filter-panel-title {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--story-text-muted);
    }

    .filter-clear {
      border: none;
      background: none;
      padding: 0;
      color: var(--story-primary);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 600;
      cursor: pointer;
    }

    .filter-clear:hover {
      text-decoration: underline;
    }

    .filter-empty {
      margin: 0;
      font-size: 0.86rem;
    }

    .filter-checklist {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 9.5rem;
      overflow: auto;
      display: grid;
      gap: 0.25rem;
    }

    .filter-check {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.88rem;
      color: #0f172a;
      cursor: pointer;
    }

    .filter-check input {
      width: 0.95rem;
      height: 0.95rem;
      accent-color: var(--story-primary);
    }

    .kpi {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.95rem 1rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
      transition: border-color 0.18s ease, transform 0.18s ease;
    }

    .kpi:hover {
      border-color: var(--story-border-strong);
      transform: translateY(-1px);
    }

    .kpi.compact {
      display: block;
      border-left: 4px solid transparent;
    }

    .kpi-danger {
      border-color: rgba(185, 28, 28, 0.24);
    }

    .kpi-icon {
      width: 2.35rem;
      height: 2.35rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
      flex-shrink: 0;
    }

    .kpi-icon--blue { background: rgba(30, 64, 175, 0.10); color: var(--story-primary); }
    .kpi-icon--green { background: rgba(21, 128, 61, 0.10); color: var(--story-success); }
    .kpi-icon--amber { background: rgba(245, 158, 11, 0.14); color: var(--story-accent-muted); }
    .kpi-icon--red { background: rgba(185, 28, 28, 0.09); color: var(--story-danger); }

    .kpi-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--story-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.2rem;
    }

    .kpi-value {
      display: block;
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      letter-spacing: -0.015em;
    }

    .kpi-value.negative {
      color: var(--story-danger);
    }

    .stats-layout {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(18rem, 0.8fr);
      gap: 1rem;
      align-items: start;
    }

    .stats-block {
      padding: 1.15rem 1.25rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }

    .block-head {
      margin-bottom: 1rem;
    }

    .block-head h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #0f172a;
    }

    .block-sub {
      display: block;
      margin-top: 0.25rem;
      color: #64748b;
      font-size: 0.86rem;
    }

    .stats-muted {
      margin: 0;
      color: var(--story-text-muted);
      font-size: 0.95rem;
    }

    .stats-loading {
      margin-top: 0.75rem;
    }

    .daily-chart {
      display: grid;
      gap: 0.6rem;
    }

    .day-row {
      display: grid;
      grid-template-columns: 3.8rem minmax(0, 1fr) 2.5rem;
      align-items: center;
      gap: 0.7rem;
      font-size: 0.86rem;
    }

    .day-label {
      color: #64748b;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .day-total {
      color: #0f172a;
      text-align: right;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .day-bars {
      display: grid;
      gap: 3px;
      padding: 0.35rem;
      background: #f8fafc;
      border: 1px solid var(--story-border);
      border-radius: 10px;
    }

    .day-bar {
      display: block;
      height: 0.45rem;
      border-radius: 999px;
      transition: width 0.25s ease;
    }

    .day-bar.in { background: linear-gradient(90deg, #16a34a, #86efac); }
    .day-bar.out { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .day-bar.adj { background: linear-gradient(90deg, #7c3aed, #c4b5fd); }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1rem;
      color: #64748b;
      font-size: 0.82rem;
    }

    .legend span {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    .legend-dot {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
    }

    .legend-dot.in { background: #16a34a; }
    .legend-dot.out { background: #f59e0b; }
    .legend-dot.adj { background: #7c3aed; }

    .top-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.55rem;
    }

    .top-list li {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: 0.65rem;
      padding: 0.6rem 0.65rem;
      border: 1px solid var(--story-border);
      border-radius: 10px;
      background: #ffffff;
    }

    .top-rank {
      width: 1.65rem;
      height: 1.65rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: rgba(30, 64, 175, 0.08);
      color: var(--story-primary);
      font-weight: 800;
      font-size: 0.8rem;
    }

    .top-link {
      min-width: 0;
      color: #0f172a;
      font-weight: 600;
      text-decoration: none;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .top-link:hover {
      color: var(--story-primary);
      text-decoration: underline;
    }

    .top-qty {
      color: var(--story-text-muted);
      font-size: 0.86rem;
      font-weight: 600;
      white-space: nowrap;
    }

    @media (max-width: 860px) {
      .stats-head {
        align-items: flex-start;
      }

      .stats-head-visual {
        display: none;
      }

      .stats-layout {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 560px) {
      .stats-page {
        padding-inline: 0.25rem;
      }

      .filters-row > * {
        width: 100%;
      }

      .btn-apply {
        width: 100%;
      }

      .day-row {
        grid-template-columns: 3.5rem minmax(0, 1fr) 2rem;
      }
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
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly maxUnidadesEnSerie = signal(1);

  protected readonly desdeStr = signal(EstadisticasComponent.defaultDesde());
  protected readonly hastaStr = signal(EstadisticasComponent.defaultHasta());
  protected readonly categoriasSeleccionadas = signal<number[]>([]);
  protected readonly carpetasSeleccionadas = signal<number[]>([]);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  private readonly carpetasArbol = signal<CarpetaArbolDto[]>([]);
  protected readonly carpetasOpciones = computed(() => flattenCarpetas(this.carpetasArbol()));
  protected readonly data = signal<InventarioEstadisticasDto | null>(null);
  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getCategorias().subscribe({
      next: (list) => this.categorias.set(list),
      error: () => this.categorias.set([]),
    });
    this.api.getCarpetasArbol().subscribe({
      next: (arbol) => this.carpetasArbol.set(arbol),
      error: () => this.carpetasArbol.set([]),
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

  protected categoriaSeleccionada(id: number): boolean {
    return this.categoriasSeleccionadas().includes(id);
  }

  protected carpetaSeleccionada(id: number): boolean {
    return this.carpetasSeleccionadas().includes(id);
  }

  protected onCategoriaCheck(id: number, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const cur = this.categoriasSeleccionadas();
    this.categoriasSeleccionadas.set(
      checked ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id),
    );
  }

  protected onCarpetaCheck(id: number, ev: Event): void {
    const checked = (ev.target as HTMLInputElement).checked;
    const cur = this.carpetasSeleccionadas();
    this.carpetasSeleccionadas.set(
      checked ? (cur.includes(id) ? cur : [...cur, id]) : cur.filter((x) => x !== id),
    );
  }

  protected limpiarCategorias(): void {
    this.categoriasSeleccionadas.set([]);
  }

  protected limpiarCarpetas(): void {
    this.carpetasSeleccionadas.set([]);
  }

  protected cargar(): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.api
      .getInventarioEstadisticas(
        this.desdeStr(),
        this.hastaStr(),
        this.categoriasSeleccionadas(),
        this.carpetasSeleccionadas(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          this.data.set(d);
          const max = d.seriePorDia.length
            ? Math.max(
                1,
                ...d.seriePorDia.flatMap((s) => [
                  s.entradasUnidades,
                  s.salidasUnidades,
                  s.ajustesUnidades,
                ]),
              )
            : 1;
          this.maxUnidadesEnSerie.set(max);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.errorMsg.set('No se pudieron cargar las estadísticas. Revisa la sesión y el rango de fechas.');
        },
      });
  }

  protected pctSerie(unidades: number): number {
    return Math.max(unidades > 0 ? 4 : 0, (unidades / this.maxUnidadesEnSerie()) * 100);
  }

  protected companyCurrency(): string {
    return this.auth.currentUser()?.companyCurrency ?? 'EUR';
  }

  protected balanceNeto(d: InventarioEstadisticasDto): number {
    return d.unidadesEntrada - d.unidadesSalida;
  }
}
