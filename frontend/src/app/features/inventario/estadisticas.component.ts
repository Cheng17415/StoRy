import { CurrencyPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  InventarioEstadisticasDto,
  InventarioResultadosDto,
  MovimientoPeriodoDto,
  CarpetaArbolDto,
  CategoriaDto,
} from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';
import { ExportFormatMenuComponent } from '../../core/components/export-format-menu.component';
import { EstadisticasExportService } from '../../core/services/estadisticas-export.service';
import { canViewEstadisticas } from '../../core/utils/company-role.util';
import {
  GuardarArchivoOpciones,
  guardarArchivoConDialogo,
} from '../../core/utils/save-file.util';

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

type PeriodoPresetId = '7d' | '30d' | '90d' | 'mes' | 'mes-anterior' | 'custom';
type EstadisticasVista = 'resumen' | 'resultados';

interface PeriodoPresetOption {
  id: PeriodoPresetId;
  label: string;
}

interface ValorDonutSliceVm {
  key: string;
  label: string;
  color: string;
  dashArray: string;
  dashOffset: number;
  valueLine: string;
}

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, ExportFormatMenuComponent],
  template: `
    <div class="stats-page">
      <div class="stats-page-layout">
        <aside class="stats-sidebar">
      <section class="stats-filters" aria-labelledby="filtros-stats">
        <h2 id="filtros-stats" class="sr-only">Filtros</h2>
        <article class="filter-card filter-card--period">
          <header class="filter-card-head">
            <span class="filter-card-icon filter-card-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
              </svg>
            </span>
            <div class="filter-card-titles">
              <h3 class="filter-card-title">Periodo</h3>
              <p class="filter-card-sub">
                {{ periodoLabel() }}
                @if (loading()) {
                  <span class="period-loading" aria-live="polite"> · Cargando…</span>
                }
              </p>
            </div>
          </header>
          <div class="date-presets" role="group" aria-label="Periodos rápidos">
            @for (opt of periodoPresets; track opt.id) {
              <button
                type="button"
                class="date-preset-chip"
                [class.date-preset-chip--active]="presetActivo() === opt.id"
                [attr.aria-pressed]="presetActivo() === opt.id"
                (click)="aplicarPreset(opt.id)"
              >
                {{ opt.label }}
              </button>
            }
          </div>
          <div class="date-range">
            <div class="date-field">
              <label class="date-field-label" for="stats-desde">Desde</label>
              <div class="date-input-wrap">
                <svg class="date-input-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                </svg>
                <input
                  id="stats-desde"
                  type="date"
                  class="date-input"
                  [value]="desdeStr()"
                  [max]="hastaStr()"
                  (change)="onDesde($event)"
                />
              </div>
            </div>
            <span class="date-range-sep" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
            <div class="date-field">
              <label class="date-field-label" for="stats-hasta">Hasta</label>
              <div class="date-input-wrap">
                <svg class="date-input-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                </svg>
                <input
                  id="stats-hasta"
                  type="date"
                  class="date-input"
                  [value]="hastaStr()"
                  [min]="desdeStr()"
                  (change)="onHasta($event)"
                />
              </div>
            </div>
          </div>
          @if (!rangoValido()) {
            <p class="date-range-error" role="alert">La fecha de inicio no puede ser posterior a la de fin.</p>
          }
        </article>
        <div class="filters-scope" aria-label="Filtros por carpeta y categoría">
          <article class="filter-card">
            <header class="filter-card-head">
              <span class="filter-card-icon filter-card-icon--amber" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 7h-7L9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                </svg>
              </span>
              <div class="filter-card-titles">
                <h3 class="filter-card-title">Carpetas</h3>
                <p class="filter-card-sub">Selecciona una o varias</p>
              </div>
              @if (filtrosCarpetaActivos() > 0) {
                <span class="filter-badge">{{ filtrosCarpetaActivos() }}</span>
                <button type="button" class="filter-clear-btn" (click)="limpiarCarpetas()">Limpiar</button>
              }
            </header>
            <div class="filter-chips" role="group" aria-label="Filtrar por carpeta">
              <button
                type="button"
                class="filter-chip filter-chip--folder filter-chip--root"
                [class.filter-chip--active]="carpetaRaizSeleccionada()"
                [attr.aria-pressed]="carpetaRaizSeleccionada()"
                (click)="toggleCarpetaRaiz()"
              >
                @if (carpetaRaizSeleccionada()) {
                  <svg class="filter-chip-check" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
                  </svg>
                }
                <span class="filter-chip-label">Raíz</span>
              </button>
              @for (c of carpetasOpciones(); track c.id) {
                  <button
                    type="button"
                    class="filter-chip filter-chip--folder"
                    [class.filter-chip--active]="carpetaSeleccionada(c.id)"
                    [attr.aria-pressed]="carpetaSeleccionada(c.id)"
                    (click)="toggleCarpetaChip(c.id)"
                  >
                    @if (carpetaSeleccionada(c.id)) {
                      <svg class="filter-chip-check" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
                      </svg>
                    }
                    <span class="filter-chip-label">{{ c.nombre }}</span>
                  </button>
                }
              @if (carpetasOpciones().length === 0) {
                <span class="filter-empty-inline">Sin subcarpetas</span>
              }
            </div>
          </article>
          <article class="filter-card">
            <header class="filter-card-head">
              <span class="filter-card-icon filter-card-icon--blue" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                </svg>
              </span>
              <div class="filter-card-titles">
                <h3 class="filter-card-title">Categorías</h3>
                <p class="filter-card-sub">Selecciona una o varias</p>
              </div>
              @if (filtrosCategoriaActivos() > 0) {
                <span class="filter-badge">{{ filtrosCategoriaActivos() }}</span>
                <button type="button" class="filter-clear-btn" (click)="limpiarCategorias()">Limpiar</button>
              }
            </header>
            <div class="filter-chips" role="group" aria-label="Filtrar por categoría">
              <button
                type="button"
                class="filter-chip filter-chip--root"
                [class.filter-chip--active]="categoriaRaizSeleccionada()"
                [attr.aria-pressed]="categoriaRaizSeleccionada()"
                (click)="toggleCategoriaRaiz()"
              >
                @if (categoriaRaizSeleccionada()) {
                  <svg class="filter-chip-check" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
                  </svg>
                }
                <span class="filter-chip-label">Raíz</span>
              </button>
              @for (c of categorias(); track c.id) {
                  <button
                    type="button"
                    class="filter-chip"
                    [class.filter-chip--active]="categoriaSeleccionada(c.id)"
                    [attr.aria-pressed]="categoriaSeleccionada(c.id)"
                    (click)="toggleCategoriaChip(c.id)"
                  >
                    @if (categoriaSeleccionada(c.id)) {
                      <svg class="filter-chip-check" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                        <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
                      </svg>
                    }
                    <span class="filter-chip-label">{{ c.nombre }}</span>
                  </button>
                }
              @if (categorias().length === 0) {
                <span class="filter-empty-inline">Sin categorías</span>
              }
            </div>
          </article>
        </div>
      </section>
        </aside>

        <div class="stats-main">
        @if (errorMsg()) {
          <p class="stats-error" role="alert">{{ errorMsg() }}</p>
        }
        @if (loading() && !data()) {
          <p class="stats-muted stats-loading">Cargando datos del periodo…</p>
        }

      @if (data(); as d) {
        <nav class="stats-view-tabs" aria-label="Vista de estadísticas">
          <button
            type="button"
            class="stats-view-tab"
            [class.stats-view-tab--active]="vista() === 'resumen'"
            [attr.aria-pressed]="vista() === 'resumen'"
            (click)="setVista('resumen')"
          >
            Resumen
          </button>
          <button
            type="button"
            class="stats-view-tab"
            [class.stats-view-tab--active]="vista() === 'resultados'"
            [attr.aria-pressed]="vista() === 'resultados'"
            (click)="setVista('resultados')"
          >
            Beneficios y pérdidas
          </button>
        </nav>

        @if (vista() === 'resumen') {
        <div class="stats-layout">
          <section class="stats-block chart-block" aria-labelledby="serie-title">
            <div class="block-head block-head--actions">
              <div class="block-head-text">
                <h2 id="serie-title">Actividad diaria</h2>
                <span class="block-sub">{{ periodoLabel() }} · Entradas, salidas y ajustes por día</span>
              </div>
              @if (canExport()) {
                <app-export-format-menu
                  class="block-head-export"
                  [disabled]="movimientosPeriodo().length === 0"
                  [busy]="exportando()"
                  ariaLabel="Exportar movimientos del periodo"
                  (exportCsv)="exportarMovimientosCsv()"
                  (exportExcel)="exportarMovimientosExcel()"
                  (exportPdf)="exportarMovimientosPdf()"
                />
              }
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

          <div class="stats-side">
          <section class="stats-block pie-block" aria-labelledby="valor-pie-title">
            <div class="block-head">
              <h2 id="valor-pie-title">Valor por movimiento</h2>
              <span class="block-sub">{{ d.totalMovimientos }} movimientos en el periodo</span>
            </div>
            @if (valorMovimientoTotal(d) <= 0 && !hayUnidadesMovimiento(d)) {
              <p class="stats-muted">No hay movimientos en este rango.</p>
            } @else {
              <div class="donut-widget" role="img" [attr.aria-label]="pieAriaLabel(d)">
                <div class="donut-widget-chart">
                  <svg viewBox="0 0 200 200" class="donut-svg" aria-hidden="true">
                    @for (slice of valorDonutSlices(d); track slice.key) {
                      <circle
                        class="donut-segment"
                        cx="100"
                        cy="100"
                        r="72"
                        fill="none"
                        [attr.stroke]="slice.color"
                        stroke-width="26"
                        stroke-linecap="round"
                        [attr.stroke-dasharray]="slice.dashArray"
                        [attr.stroke-dashoffset]="slice.dashOffset"
                        transform="rotate(-90 100 100)"
                      />
                    }
                  </svg>
                  <div class="donut-center">
                    <span class="donut-center-label">Total</span>
                    <strong class="donut-center-value">{{ valorPieCenterText(d) }}</strong>
                  </div>
                </div>
                <ul class="donut-legend">
                  @for (slice of valorDonutSlices(d); track slice.key) {
                    <li>
                      <span class="donut-legend-swatch" [style.background-color]="slice.color"></span>
                      <span class="donut-legend-body">
                        <span class="donut-legend-name">{{ slice.label }}</span>
                        <strong class="donut-legend-value">{{ slice.valueLine }}</strong>
                      </span>
                    </li>
                  }
                </ul>
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
        </div>
        }

        @if (vista() === 'resultados') {
          @if (resultados(); as r) {
            <section class="stats-block" aria-labelledby="resultados-title">
              <div class="block-head block-head--actions">
                <div class="block-head-text">
                  <h2 id="resultados-title">Beneficios y pérdidas</h2>
                  <span class="block-sub">{{ periodoLabel() }} · {{ r.totalMovimientos }} movimientos</span>
                </div>
                @if (canExport()) {
                  <app-export-format-menu
                    class="block-head-export"
                    [busy]="exportando()"
                    ariaLabel="Descargar informe de beneficios y perdidas"
                    (exportCsv)="exportarResultadosCsv()"
                    (exportExcel)="exportarResultadosExcel()"
                    (exportPdf)="exportarResultadosPdf()"
                  />
                }
              </div>

              <div class="resultados-kpis">
                <article class="resultados-kpi">
                  <span class="resultados-kpi-label">Valor salidas</span>
                  <strong class="resultados-kpi-value">{{ r.valorSalidas | currency: auth.companyCurrency() }}</strong>
                </article>
                <article class="resultados-kpi">
                  <span class="resultados-kpi-label">Valor entradas</span>
                  <strong class="resultados-kpi-value">{{ r.valorEntradas | currency: auth.companyCurrency() }}</strong>
                </article>
                <article
                  class="resultados-kpi resultados-kpi--highlight"
                  [class.resultados-kpi--neg]="r.resultadoNeto < 0"
                  [class.resultados-kpi--pos]="r.resultadoNeto > 0"
                >
                  <span class="resultados-kpi-label">Resultado neto</span>
                  <strong class="resultados-kpi-value">{{ r.resultadoNeto | currency: auth.companyCurrency() }}</strong>
                </article>
              </div>

              @if (r.porProducto.length === 0) {
                <p class="stats-muted">No hay entradas ni salidas con valor en este periodo.</p>
              } @else {
                <div class="resultados-table-wrap">
                  <table class="resultados-table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th class="num">Entradas</th>
                        <th class="num">Salidas</th>
                        <th class="num">Resultado</th>
                        <th class="num">Uds.</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of r.porProducto; track line.productoId) {
                        <tr [class.resultados-row--neg]="line.resultado < 0" [class.resultados-row--pos]="line.resultado > 0">
                          <td>
                            <a [routerLink]="['/producto', line.productoId]" class="resultados-link">{{ line.productoNombre }}</a>
                            <span class="resultados-code">{{ line.productoCodigo }}</span>
                          </td>
                          <td class="num">{{ line.valorEntradas | currency: auth.companyCurrency() }}</td>
                          <td class="num">{{ line.valorSalidas | currency: auth.companyCurrency() }}</td>
                          <td class="num">{{ line.resultado | currency: auth.companyCurrency() }}</td>
                          <td class="num resultados-uds">{{ line.unidadesSalida }} / {{ line.unidadesEntrada }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>
          }
        }
      }
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .stats-page {
      max-width: 80rem;
      margin: 0 auto;
      padding: 0.5rem 1rem 3rem;
    }

    .stats-page-layout {
      display: grid;
      grid-template-columns: minmax(17rem, 22rem) minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }

    .stats-sidebar {
      position: sticky;
      top: 0.75rem;
      max-height: calc(100vh - 6rem);
      overflow: auto;
    }

    .stats-main {
      min-width: 0;
    }

    .stats-filters {
      margin-bottom: 0;
      padding: 0.75rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
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

    .filter-card--period {
      margin-bottom: 0;
      border: none;
      box-shadow: none;
      padding: 0.15rem 0.1rem 0.85rem;
    }

    .filter-card-icon--green {
      background: rgba(22, 163, 74, 0.12);
      color: #15803d;
    }

    .date-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-bottom: 0.85rem;
    }

    .date-preset-chip {
      border: 1px solid var(--story-border-strong);
      border-radius: 999px;
      background: #ffffff;
      padding: 0.38rem 0.75rem;
      color: #334155;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    }

    .date-preset-chip:hover {
      border-color: #15803d;
      background: rgba(22, 163, 74, 0.06);
      color: #14532d;
    }

    .date-preset-chip--active {
      border-color: #15803d;
      background: rgba(22, 163, 74, 0.12);
      color: #14532d;
      box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.18);
    }

    .date-range {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 0.65rem;
    }

    .date-field {
      flex: 1 1 10rem;
      min-width: min(100%, 10rem);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .date-field-label {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--story-text-muted);
    }

    .date-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .date-input-icon {
      position: absolute;
      left: 0.75rem;
      color: #64748b;
      pointer-events: none;
    }

    .date-input {
      width: 100%;
      min-height: 2.55rem;
      padding: 0.55rem 0.75rem 0.55rem 2.35rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 10px;
      background: #ffffff;
      color: #0f172a;
      font: inherit;
      font-size: 0.9rem;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .date-input:hover {
      border-color: #cbd5e1;
    }

    .date-input:focus {
      outline: none;
      border-color: #15803d;
      box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.18);
    }

    .date-range-sep {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      align-self: center;
      width: 2rem;
      height: 2rem;
      color: #94a3b8;
      flex-shrink: 0;
    }

    .date-range-error {
      margin: 0.65rem 0 0;
      font-size: 0.82rem;
      color: var(--story-danger);
    }

    .period-loading {
      font-weight: 600;
      color: var(--story-primary);
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

    .filters-scope {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 0.85rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--story-border);
    }

    .filter-card {
      padding: 0.95rem 1rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 14px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    }

    .filter-card-head {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      margin-bottom: 0.75rem;
    }

    .filter-card-icon {
      width: 2.35rem;
      height: 2.35rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
      flex-shrink: 0;
    }

    .filter-card-icon--amber {
      background: rgba(245, 158, 11, 0.14);
      color: var(--story-accent-muted);
    }

    .filter-card-icon--blue {
      background: rgba(30, 64, 175, 0.10);
      color: var(--story-primary);
    }

    .filter-card-titles {
      flex: 1;
      min-width: 0;
    }

    .filter-card-title {
      margin: 0;
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #0f172a;
    }

    .filter-card-sub {
      margin: 0.15rem 0 0;
      font-size: 0.78rem;
      color: #64748b;
    }

    .filter-badge {
      min-width: 1.5rem;
      height: 1.5rem;
      padding: 0 0.4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: rgba(30, 64, 175, 0.1);
      color: var(--story-primary);
      font-size: 0.75rem;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .filter-clear-btn {
      border: 1px solid var(--story-border-strong);
      border-radius: 8px;
      background: #ffffff;
      padding: 0.3rem 0.55rem;
      color: var(--story-primary);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .filter-clear-btn:hover {
      background: rgba(30, 64, 175, 0.06);
      border-color: var(--story-primary);
    }

    .filter-empty {
      margin: 0;
      font-size: 0.88rem;
      color: var(--story-text-muted);
    }

    .filter-empty-inline {
      align-self: center;
      font-size: 0.82rem;
      color: var(--story-text-muted);
      font-style: italic;
    }

    .filter-chip--root {
      border-style: dashed;
    }

    .filter-chip--root.filter-chip--active {
      border-style: solid;
    }

    .filter-chips {
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 0.45rem;
      max-height: 8.5rem;
      overflow: auto;
      padding: 0.1rem;
    }

    .filter-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      max-width: 100%;
      padding: 0.38rem 0.7rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 999px;
      background: #ffffff;
      color: #334155;
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease,
        box-shadow 0.15s ease;
    }

    .filter-chip:hover {
      border-color: var(--story-primary);
      background: rgba(30, 64, 175, 0.04);
    }

    .filter-chip--active {
      border-color: var(--story-primary);
      background: rgba(30, 64, 175, 0.1);
      color: var(--story-primary);
      box-shadow: 0 0 0 1px rgba(30, 64, 175, 0.12);
    }

    .filter-chip--folder.filter-chip--active {
      border-color: var(--story-accent-muted);
      background: rgba(245, 158, 11, 0.12);
      color: #b45309;
      box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.2);
    }

    .filter-chip-check {
      flex-shrink: 0;
    }

    .filter-chip-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

    .stats-side {
      display: grid;
      gap: 1rem;
      align-content: start;
    }

    .donut-widget {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.35rem;
      width: 100%;
    }

    .donut-widget-chart {
      position: relative;
      width: min(100%, 13.5rem);
      aspect-ratio: 1;
    }

    .donut-svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .donut-segment {
      transition: opacity 0.15s ease;
    }

    .donut-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      padding: 1.5rem;
      text-align: center;
      pointer-events: none;
    }

    .donut-center-label {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--story-text-muted, #94a3b8);
    }

    .donut-center-value {
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1.15;
      color: var(--story-text, #0f172a);
      letter-spacing: -0.02em;
    }

    .donut-legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.85rem 1.35rem;
      width: 100%;
    }

    .donut-legend li {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      min-width: 6.5rem;
    }

    .donut-legend-swatch {
      width: 0.7rem;
      height: 0.7rem;
      border-radius: 4px;
      margin-top: 0.2rem;
      flex-shrink: 0;
    }

    .donut-legend-body {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .donut-legend-name {
      font-size: 0.78rem;
      font-weight: 500;
      color: var(--story-text-muted, #94a3b8);
      line-height: 1.2;
    }

    .donut-legend-value {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--story-text, #0f172a);
      line-height: 1.25;
    }

    .pie-block .block-head {
      margin-bottom: 0.75rem;
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

    .block-head--actions {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .block-head-text {
      min-width: 0;
      flex: 1 1 auto;
    }

    .block-head-export {
      flex: 0 0 auto;
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

    @media (max-width: 960px) {
      .stats-page-layout {
        grid-template-columns: 1fr;
      }

      .stats-sidebar {
        position: static;
        max-height: none;
        overflow: visible;
      }
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

      .filter-card-head {
        flex-wrap: wrap;
      }

      .date-range {
        flex-direction: column;
        align-items: stretch;
      }

      .date-range-sep {
        align-self: center;
        transform: rotate(90deg);
      }

      .day-row {
        grid-template-columns: 3.5rem minmax(0, 1fr) 2rem;
      }
    }

    .stats-view-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin: 0 0 1rem;
      padding: 0.25rem;
      background: var(--story-surface);
      border: 1px solid var(--story-border);
      border-radius: 12px;
    }

    .stats-view-tab {
      flex: 1 1 auto;
      min-width: 7rem;
      padding: 0.55rem 0.85rem;
      border: none;
      border-radius: 9px;
      background: transparent;
      color: var(--story-text-muted);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }

    .stats-view-tab:hover {
      color: #0f172a;
      background: rgba(30, 64, 175, 0.06);
    }

    .stats-view-tab--active {
      background: var(--story-primary);
      color: #fff;
      box-shadow: 0 1px 3px rgba(30, 64, 175, 0.35);
    }

    .resultados-kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .resultados-kpi {
      padding: 0.85rem 1rem;
      border: 1px solid var(--story-border);
      border-radius: 12px;
      background: #fff;
    }

    .resultados-kpi-label {
      display: block;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--story-text-muted);
      margin-bottom: 0.25rem;
    }

    .resultados-kpi-value {
      display: block;
      font-size: 1.15rem;
      color: #0f172a;
    }

    .resultados-kpi-hint {
      display: block;
      margin-top: 0.35rem;
      font-size: 0.72rem;
      color: var(--story-text-muted);
      line-height: 1.35;
    }

    .resultados-kpi--highlight {
      border-color: rgba(30, 64, 175, 0.25);
      background: rgba(30, 64, 175, 0.04);
    }

    .resultados-kpi--pos .resultados-kpi-value {
      color: #15803d;
    }

    .resultados-kpi--neg .resultados-kpi-value {
      color: #b91c1c;
    }

    .resultados-table-wrap {
      overflow-x: auto;
      border: 1px solid var(--story-border);
      border-radius: 12px;
    }

    .resultados-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.86rem;
    }

    .resultados-table th,
    .resultados-table td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid var(--story-border);
      text-align: left;
    }

    .resultados-table th.num,
    .resultados-table td.num {
      text-align: right;
      white-space: nowrap;
    }

    .resultados-table thead th {
      background: #f8fafc;
      font-size: 0.78rem;
      font-weight: 700;
      color: #475569;
    }

    .resultados-link {
      display: block;
      color: #0f172a;
      font-weight: 600;
      text-decoration: none;
    }

    .resultados-link:hover {
      color: var(--story-primary);
      text-decoration: underline;
    }

    .resultados-code {
      display: block;
      font-size: 0.76rem;
      color: var(--story-text-muted);
    }

    .resultados-uds {
      font-size: 0.8rem;
      color: var(--story-text-muted);
    }

    .resultados-row--pos td.num:nth-child(4) {
      color: #15803d;
      font-weight: 700;
    }

    .resultados-row--neg td.num:nth-child(4) {
      color: #b91c1c;
      font-weight: 700;
    }

    @media (max-width: 720px) {
      .resultados-kpis {
        grid-template-columns: 1fr;
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
  private readonly exportSvc = inject(EstadisticasExportService);
  protected readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly maxUnidadesEnSerie = signal(1);

  protected readonly periodoPresets: PeriodoPresetOption[] = [
    { id: '7d', label: '7 días' },
    { id: '30d', label: '30 días' },
    { id: '90d', label: '90 días' },
    { id: 'mes', label: 'Este mes' },
    { id: 'mes-anterior', label: 'Mes anterior' },
  ];

  protected readonly desdeStr = signal(EstadisticasComponent.defaultDesde());
  protected readonly hastaStr = signal(EstadisticasComponent.defaultHasta());
  protected readonly presetActivo = signal<PeriodoPresetId>('30d');
  protected readonly periodoLabel = computed(() => {
    const fmt = EstadisticasComponent.formatFechaCorta;
    return `${fmt(this.desdeStr())} – ${fmt(this.hastaStr())}`;
  });
  protected readonly rangoValido = computed(() => this.desdeStr() <= this.hastaStr());
  protected readonly categoriasSeleccionadas = signal<number[]>([]);
  protected readonly carpetasSeleccionadas = signal<number[]>([]);
  protected readonly categoriaRaizSeleccionada = signal(false);
  protected readonly carpetaRaizSeleccionada = signal(false);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  private readonly carpetasArbol = signal<CarpetaArbolDto[]>([]);
  protected readonly carpetasOpciones = computed(() => flattenCarpetas(this.carpetasArbol()));
  protected readonly data = signal<InventarioEstadisticasDto | null>(null);
  protected readonly movimientosPeriodo = signal<MovimientoPeriodoDto[]>([]);
  protected readonly resultados = signal<InventarioResultadosDto | null>(null);
  protected readonly vista = signal<EstadisticasVista>('resumen');
  protected readonly exportando = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMsg = signal<string | null>(null);
  protected readonly canExport = computed(() =>
    canViewEstadisticas(this.auth.currentUser()?.companyRole),
  );

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

  private static formatFechaCorta(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) {
      return ymd;
    }
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(y, m - 1, d));
  }

  protected aplicarPreset(preset: PeriodoPresetId): void {
    const hoy = new Date();
    let desde: Date;
    let hasta = hoy;

    switch (preset) {
      case '7d':
        desde = new Date(hoy.getTime() - 6 * 86400000);
        break;
      case '30d':
        desde = new Date(hoy.getTime() - 29 * 86400000);
        break;
      case '90d':
        desde = new Date(hoy.getTime() - 89 * 86400000);
        break;
      case 'mes':
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        break;
      case 'mes-anterior':
        desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
        hasta = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
        break;
      default:
        return;
    }

    this.desdeStr.set(EstadisticasComponent.toYmdUtc(desde));
    this.hastaStr.set(EstadisticasComponent.toYmdUtc(hasta));
    this.presetActivo.set(preset);
    this.cargar();
  }

  protected onDesde(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v) {
      this.desdeStr.set(v);
      this.presetActivo.set('custom');
      this.cargar();
    }
  }

  protected onHasta(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    if (v) {
      this.hastaStr.set(v);
      this.presetActivo.set('custom');
      this.cargar();
    }
  }

  protected categoriaSeleccionada(id: number): boolean {
    return this.categoriasSeleccionadas().includes(id);
  }

  protected carpetaSeleccionada(id: number): boolean {
    return this.carpetasSeleccionadas().includes(id);
  }

  protected toggleCategoriaChip(id: number): void {
    const cur = this.categoriasSeleccionadas();
    this.categoriasSeleccionadas.set(
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
    this.cargar();
  }

  protected toggleCarpetaChip(id: number): void {
    const cur = this.carpetasSeleccionadas();
    this.carpetasSeleccionadas.set(
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
    this.cargar();
  }

  protected filtrosCategoriaActivos(): number {
    return this.categoriasSeleccionadas().length + (this.categoriaRaizSeleccionada() ? 1 : 0);
  }

  protected filtrosCarpetaActivos(): number {
    return this.carpetasSeleccionadas().length + (this.carpetaRaizSeleccionada() ? 1 : 0);
  }

  protected toggleCategoriaRaiz(): void {
    this.categoriaRaizSeleccionada.update((v) => !v);
    this.cargar();
  }

  protected toggleCarpetaRaiz(): void {
    this.carpetaRaizSeleccionada.update((v) => !v);
    this.cargar();
  }

  protected limpiarCategorias(): void {
    this.categoriasSeleccionadas.set([]);
    this.categoriaRaizSeleccionada.set(false);
    this.cargar();
  }

  protected limpiarCarpetas(): void {
    this.carpetasSeleccionadas.set([]);
    this.carpetaRaizSeleccionada.set(false);
    this.cargar();
  }

  protected setVista(v: EstadisticasVista): void {
    this.vista.set(v);
  }

  protected cargar(): void {
    if (!this.rangoValido()) {
      return;
    }
    this.loading.set(true);
    this.errorMsg.set(null);
    const desde = this.desdeStr();
    const hasta = this.hastaStr();
    const categorias = this.categoriasSeleccionadas();
    const carpetas = this.carpetasSeleccionadas();
    const catRaiz = this.categoriaRaizSeleccionada();
    const carpRaiz = this.carpetaRaizSeleccionada();

    forkJoin({
      stats: this.api.getInventarioEstadisticas(desde, hasta, categorias, carpetas, catRaiz, carpRaiz),
      movimientos: this.api.getMovimientosPeriodo(desde, hasta, categorias, carpetas, catRaiz, carpRaiz),
      resultados: this.api.getResultadosPeriodo(desde, hasta, categorias, carpetas, catRaiz, carpRaiz),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ stats, movimientos, resultados }) => {
          this.data.set(stats);
          this.movimientosPeriodo.set(movimientos);
          this.resultados.set(resultados);
          const max = stats.seriePorDia.length
            ? Math.max(
                1,
                ...stats.seriePorDia.flatMap((s) => [
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
          this.data.set(null);
          this.movimientosPeriodo.set([]);
          this.resultados.set(null);
          this.loading.set(false);
          this.errorMsg.set('No se pudieron cargar las estadísticas. Revisa la sesión y el rango de fechas.');
        },
      });
  }

  protected exportarMovimientosCsv(): void {
    void this.exportarMovimientos('csv');
  }

  protected exportarMovimientosExcel(): void {
    void this.exportarMovimientos('excel');
  }

  protected exportarMovimientosPdf(): void {
    void this.exportarMovimientos('pdf');
  }

  protected exportarResultadosCsv(): void {
    void this.exportarResultados('csv');
  }

  protected exportarResultadosExcel(): void {
    void this.exportarResultados('excel');
  }

  protected exportarResultadosPdf(): void {
    void this.exportarResultados('pdf');
  }

  private formatCurrencyExport(n: number): string {
    return new Intl.NumberFormat('es', {
      style: 'currency',
      currency: this.auth.companyCurrency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  private async exportarMovimientos(kind: 'csv' | 'excel' | 'pdf'): Promise<void> {
    const rows = this.movimientosPeriodo();
    if (rows.length === 0 || this.exportando()) {
      return;
    }
    const desde = this.desdeStr();
    const hasta = this.hastaStr();
    const meta = this.exportSvc.metaMovimientos(desde, hasta, rows.length);
    const fmt = (n: number) => this.formatCurrencyExport(n);

    this.exportando.set(true);
    try {
      if (kind === 'csv') {
        await this.guardarExport(() => this.exportSvc.buildMovimientosCsv(rows, fmt), {
          suggestedName: `${meta.slug}.csv`,
          description: 'CSV (valores separados)',
          mimeType: 'text/csv',
          extension: 'csv',
        });
      } else if (kind === 'excel') {
        await this.guardarExport(() => this.exportSvc.buildMovimientosExcel(rows, meta, fmt), {
          suggestedName: `${meta.slug}.xlsx`,
          description: 'Libro de Excel',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        });
      } else {
        await this.guardarExport(() => this.exportSvc.buildMovimientosPdf(rows, meta, fmt), {
          suggestedName: `${meta.slug}.pdf`,
          description: 'Documento PDF',
          mimeType: 'application/pdf',
          extension: 'pdf',
        });
      }
    } finally {
      this.exportando.set(false);
    }
  }

  private async exportarResultados(kind: 'csv' | 'excel' | 'pdf'): Promise<void> {
    const r = this.resultados();
    if (!r || this.exportando()) {
      return;
    }
    const desde = this.desdeStr();
    const hasta = this.hastaStr();
    const meta = this.exportSvc.metaResultados(desde, hasta);
    const fmt = (n: number) => this.formatCurrencyExport(n);

    this.exportando.set(true);
    try {
      if (kind === 'csv') {
        await this.guardarExport(() => this.exportSvc.buildResultadosCsv(r, fmt), {
          suggestedName: `${meta.slug}.csv`,
          description: 'CSV (valores separados)',
          mimeType: 'text/csv',
          extension: 'csv',
        });
      } else if (kind === 'excel') {
        await this.guardarExport(() => this.exportSvc.buildResultadosExcel(r, meta, fmt), {
          suggestedName: `${meta.slug}.xlsx`,
          description: 'Libro de Excel',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        });
      } else {
        await this.guardarExport(() => this.exportSvc.buildResultadosPdf(r, meta, fmt), {
          suggestedName: `${meta.slug}.pdf`,
          description: 'Documento PDF',
          mimeType: 'application/pdf',
          extension: 'pdf',
        });
      }
    } finally {
      this.exportando.set(false);
    }
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
      this.errorMsg.set(
        'Tu navegador no permite elegir dónde guardar. Usa Chrome o Edge actualizado en HTTPS o localhost.',
      );
      return;
    }
    this.errorMsg.set('No se pudo guardar el archivo.');
  }

  protected pctSerie(unidades: number): number {
    return Math.max(unidades > 0 ? 4 : 0, (unidades / this.maxUnidadesEnSerie()) * 100);
  }

  protected hayUnidadesMovimiento(d: InventarioEstadisticasDto): boolean {
    return d.unidadesEntrada + d.unidadesSalida + d.unidadesAjuste > 0;
  }

  protected valorNum(v: number | null | undefined): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  protected valorMovimientoTotal(d: InventarioEstadisticasDto): number {
    return this.valorNum(d.valorEntrada) + this.valorNum(d.valorSalida) + this.valorNum(d.valorAjuste);
  }

  protected valorPieCenterText(d: InventarioEstadisticasDto): string {
    const currency = this.auth.companyCurrency();
    const totalValor = this.valorMovimientoTotal(d);
    if (totalValor > 0) {
      return this.formatCurrencyCompact(totalValor, currency);
    }
    const totalUds = d.unidadesEntrada + d.unidadesSalida + d.unidadesAjuste;
    return `${totalUds} uds.`;
  }

  protected valorDonutSlices(d: InventarioEstadisticasDto): ValorDonutSliceVm[] {
    const useUnits = this.valorMovimientoTotal(d) <= 0 && this.hayUnidadesMovimiento(d);
    const currency = this.auth.companyCurrency();
    const radius = 72;
    const circumference = 2 * Math.PI * radius;

    const defs = [
      { key: 'entrada', label: 'Entradas', color: '#16a34a', value: this.valorNum(d.valorEntrada), units: d.unidadesEntrada },
      { key: 'salida', label: 'Salidas', color: '#f59e0b', value: this.valorNum(d.valorSalida), units: d.unidadesSalida },
      { key: 'ajuste', label: 'Ajustes', color: '#7c3aed', value: this.valorNum(d.valorAjuste), units: d.unidadesAjuste },
    ];

    const items = defs
      .map((item) => ({ ...item, weight: useUnits ? item.units : item.value }))
      .filter((item) => item.weight > 0);

    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) {
      return [];
    }

    const segmentGap = items.length > 1 ? 5 : 0;
    let offset = 0;

    return items.map((item) => {
      const pct = (item.weight / total) * 100;
      const segmentLen = Math.max(0, (item.weight / total) * circumference - segmentGap);
      const dashArray = `${segmentLen} ${circumference - segmentLen}`;
      const dashOffset = -offset;

      offset += segmentLen + segmentGap;

      const pctLabel = `${pct.toFixed(pct >= 10 ? 0 : 1)}%`;
      let valueLine: string;
      if (useUnits) {
        valueLine = `${item.units} uds. (${pctLabel})`;
      } else {
        const amount = this.formatCurrencyCompact(item.value, currency);
        valueLine =
          item.units > 0 && item.key !== 'ajuste'
            ? `${amount} · ${item.units} uds. (${pctLabel})`
            : `${amount} (${pctLabel})`;
      }

      return {
        key: item.key,
        label: item.label,
        color: item.color,
        dashArray,
        dashOffset,
        valueLine,
      };
    });
  }

  protected pieAriaLabel(d: InventarioEstadisticasDto): string {
    return this.valorDonutSlices(d)
      .map((s) => `${s.label}: ${s.valueLine}`)
      .join('. ');
  }

  private formatCurrencyCompact(amount: number, currency: string): string {
    return new Intl.NumberFormat('es', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  }

}
