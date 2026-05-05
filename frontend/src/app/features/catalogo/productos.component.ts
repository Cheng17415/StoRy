import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';
import { MovimientoStockDto, ProductoDto } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';

interface ProductosPageData {
  items: ProductoDto[];
  itemCount: number;
  totalQty: number;
  totalValue: number;
}

type SortField = 'name' | 'updated' | 'quantity' | 'price';
type SortDir = 'asc' | 'desc';

interface SortState {
  field: SortField;
  dir: SortDir;
}

type LayoutMode = 'grid' | 'list' | 'table';

const LAYOUT_STORAGE_KEY = 'story_productos_layout';

function readStoredLayout(): LayoutMode {
  if (typeof localStorage === 'undefined') {
    return 'grid';
  }
  try {
    const v = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (v === 'grid' || v === 'list' || v === 'table') {
      return v;
    }
  } catch {
    /* private mode */
  }
  return 'grid';
}

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [AsyncPipe, DatePipe, CurrencyPipe, ReactiveFormsModule],
  template: `
    <div class="productos-page">
      <header class="page-head">
        <h1 class="page-title">Todos los productos</h1>
        <div class="page-head-actions">
          @if (canCreateProduct()) {
            <button type="button" class="btn-cta" (click)="openCreate()">Añadir producto</button>
          }
        </div>
      </header>

      <section class="toolbar-strip">
        <div class="search-wrap">
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            class="search-input"
            placeholder="Buscar productos"
            [value]="searchTerm()"
            (input)="onSearch($event)"
          />
        </div>
        <div class="toolbar-right">
          <div class="layout-dropdown" #layoutDropdown>
            <button
              type="button"
              class="layout-trigger"
              [attr.aria-expanded]="layoutMenuOpen()"
              aria-haspopup="listbox"
              [attr.aria-label]="'Tipo de vista: ' + layoutLabel()"
              (click)="toggleLayoutMenu($event)"
            >
              @switch (layoutMode()) {
                @case ('grid') {
                  <svg class="layout-trigger-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" />
                    <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" />
                    <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" />
                    <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor" />
                  </svg>
                }
                @case ('list') {
                  <svg class="layout-trigger-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="5" rx="1" fill="currentColor" />
                    <rect x="3" y="14" width="18" height="5" rx="1" fill="currentColor" />
                  </svg>
                }
                @case ('table') {
                  <svg class="layout-trigger-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="4" rx="0.5" fill="currentColor" />
                    <rect x="3" y="10" width="18" height="4" rx="0.5" fill="currentColor" />
                    <rect x="3" y="16" width="18" height="4" rx="0.5" fill="currentColor" />
                  </svg>
                }
              }
            </button>
            @if (layoutMenuOpen()) {
              <div class="layout-panel" role="listbox">
                <div class="layout-panel-title">Tipo de vista</div>
                @for (opt of layoutOptions; track opt.mode) {
                  <button
                    type="button"
                    class="layout-option"
                    role="option"
                    [class.active]="layoutMode() === opt.mode"
                    [attr.aria-selected]="layoutMode() === opt.mode"
                    (click)="selectLayout(opt.mode); $event.stopPropagation()"
                  >
                    @switch (opt.mode) {
                      @case ('grid') {
                        <svg class="layout-option-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" />
                          <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" />
                          <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" />
                          <rect x="14" y="14" width="7" height="7" rx="1" fill="currentColor" />
                        </svg>
                      }
                      @case ('list') {
                        <svg class="layout-option-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="3" y="5" width="18" height="5" rx="1" fill="currentColor" />
                          <rect x="3" y="14" width="18" height="5" rx="1" fill="currentColor" />
                        </svg>
                      }
                      @case ('table') {
                        <svg class="layout-option-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="4" rx="0.5" fill="currentColor" />
                          <rect x="3" y="10" width="18" height="4" rx="0.5" fill="currentColor" />
                          <rect x="3" y="16" width="18" height="4" rx="0.5" fill="currentColor" />
                        </svg>
                      }
                    }
                    <span class="layout-option-label">{{ opt.label }}</span>
                  </button>
                }
              </div>
            }
          </div>
          <span class="sort-toolbar-label">Ordenar</span>
          <div class="sort-dropdown" #sortDropdown>
            <button
              type="button"
              class="sort-trigger"
              [attr.aria-expanded]="sortMenuOpen()"
              aria-haspopup="listbox"
              (click)="toggleSortMenu($event)"
            >
              <span class="sort-trigger-main">{{ sortTriggerText() }}</span>
              <span class="sort-trigger-chev" aria-hidden="true">▾</span>
            </button>
            @if (sortMenuOpen()) {
              <div class="sort-panel" role="listbox">
                @for (opt of sortOptions; track opt.field) {
                  <button
                    type="button"
                    class="sort-option"
                    role="option"
                    [class.active]="sortState().field === opt.field"
                    [attr.aria-selected]="sortState().field === opt.field"
                    (click)="selectSortField(opt.field); $event.stopPropagation()"
                  >
                    <span class="sort-option-label">{{ opt.label }}</span>
                    @if (sortState().field === opt.field) {
                      <span class="sort-option-arrow" aria-hidden="true">{{
                        sortState().dir === 'desc' ? '↓' : '↑'
                      }}</span>
                    }
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </section>

      @if (pageData$ | async; as data) {
        <section class="stats-bar" aria-label="Resumen">
          <div class="stat">
            <span class="stat-label">Productos</span>
            <span class="stat-value">{{ data.itemCount }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Cantidad total</span>
            <span class="stat-value">{{ data.totalQty }} uds.</span>
          </div>
          <div class="stat">
            <span class="stat-label">Valor total</span>
            <span class="stat-value">{{ data.totalValue | currency: companyCurrency() }}</span>
          </div>
        </section>

        @if (data.items.length === 0) {
          <p class="empty-hint">
            @if (searchTerm().trim()) {
              No hay resultados para esta búsqueda.
            } @else {
              No hay productos. Pulsa «Añadir producto» para crear el primero.
            }
          </p>
        } @else {
          @switch (layoutMode()) {
            @case ('grid') {
              <div class="card-grid">
                @for (p of data.items; track p.id) {
                  <article class="product-card product-card--click" (click)="goToProducto(p.id, $event)">
                    <div class="card-image-wrap">
                      @if (p.imagen) {
                        <img [src]="p.imagen" [alt]="p.nombre" class="card-image" />
                      } @else {
                        <div class="card-placeholder" aria-hidden="true">
                          <span class="placeholder-icon">◇</span>
                        </div>
                      }
                    </div>
                    <div class="card-body">
                      <div class="card-title-row">
                        <h2 class="card-title" [class.stock-bajo]="esStockBajo(p)">{{ p.nombre }}</h2>
                        <div class="product-item-menu-root" data-stop-nav>
                          <button
                            type="button"
                            class="card-kebab"
                            [class.open]="itemMenuId() === p.id"
                            [attr.aria-expanded]="itemMenuId() === p.id"
                            aria-haspopup="menu"
                            aria-label="Más acciones"
                            (click)="toggleItemMenu(p.id, $event)"
                          >
                            <svg class="card-kebab-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <circle cx="12" cy="5" r="2" fill="currentColor" />
                              <circle cx="12" cy="12" r="2" fill="currentColor" />
                              <circle cx="12" cy="19" r="2" fill="currentColor" />
                            </svg>
                          </button>
                          @if (itemMenuId() === p.id) {
                            <div class="card-dropdown" role="menu">
                              <button type="button" role="menuitem" class="card-dd-item" (click)="openHistorial(p)">
                                Historial de stock
                              </button>
                              @if (canDeleteProduct()) {
                                <button
                                  type="button"
                                  role="menuitem"
                                  class="card-dd-item danger"
                                  (click)="confirmDeleteFromMenu(p)"
                                >
                                  Eliminar
                                </button>
                              }
                            </div>
                          }
                        </div>
                      </div>
                      <p class="card-meta">
                        <span class="card-code">{{ p.codigo }}</span>
                      </p>
                      <div class="card-footer">
                        <span class="card-qty">{{ p.cantidad }} {{ p.cantidad === 1 ? 'ud.' : 'uds.' }}</span>
                        <span class="card-sep">|</span>
                        <span class="card-price">
                          @if (p.precio != null) {
                            {{ p.precio | currency: companyCurrency() }}
                          } @else {
                            —
                          }
                        </span>
                      </div>
                    </div>
                  </article>
                }
              </div>
            }
            @case ('list') {
              <div class="product-list">
                @for (p of data.items; track p.id) {
                  <article class="product-list-row" (click)="goToProducto(p.id, $event)">
                    <div class="list-thumb">
                      @if (p.imagen) {
                        <img [src]="p.imagen" [alt]="" class="list-thumb-img" />
                      } @else {
                        <div class="list-thumb-placeholder" aria-hidden="true">◇</div>
                      }
                    </div>
                    <div class="list-main">
                      <h2 class="list-title" [class.stock-bajo]="esStockBajo(p)">{{ p.nombre }}</h2>
                      <p class="list-meta">
                        <span class="card-code">{{ p.codigo }}</span>
                        @if (p.categoriaNombre) {
                          <span class="list-cat"> · {{ p.categoriaNombre }}</span>
                        }
                      </p>
                    </div>
                    <div class="list-stats">
                      <span class="list-qty">{{ p.cantidad }} {{ p.cantidad === 1 ? 'ud.' : 'uds.' }}</span>
                      <span class="list-price">
                        @if (p.precio != null) {
                          {{ p.precio | currency: companyCurrency() }}
                        } @else {
                          —
                        }
                      </span>
                    </div>
                    <div class="product-item-menu-root list-kebab" data-stop-nav>
                      <button
                        type="button"
                        class="card-kebab"
                        [class.open]="itemMenuId() === p.id"
                        [attr.aria-expanded]="itemMenuId() === p.id"
                        aria-haspopup="menu"
                        aria-label="Más acciones"
                        (click)="toggleItemMenu(p.id, $event)"
                      >
                        <svg class="card-kebab-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="12" cy="5" r="2" fill="currentColor" />
                          <circle cx="12" cy="12" r="2" fill="currentColor" />
                          <circle cx="12" cy="19" r="2" fill="currentColor" />
                        </svg>
                      </button>
                      @if (itemMenuId() === p.id) {
                        <div class="card-dropdown card-dropdown--left" role="menu">
                          <button type="button" role="menuitem" class="card-dd-item" (click)="openHistorial(p)">
                            Historial de stock
                          </button>
                          @if (canDeleteProduct()) {
                            <button
                              type="button"
                              role="menuitem"
                              class="card-dd-item danger"
                              (click)="confirmDeleteFromMenu(p)"
                            >
                              Eliminar
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </article>
                }
              </div>
            }
            @case ('table') {
              <div class="table-scroll">
                <table class="product-table">
                  <thead>
                    <tr>
                      <th class="col-thumb" scope="col"></th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Código</th>
                      <th scope="col">Categoría</th>
                      <th scope="col" class="col-num">Uds.</th>
                      <th scope="col" class="col-num">Precio</th>
                      <th scope="col" class="col-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of data.items; track p.id) {
                      <tr
                        [class.row-stock-bajo]="esStockBajo(p)"
                        class="product-table-row"
                        (click)="goToProducto(p.id, $event)"
                      >
                        <td class="td-thumb">
                          @if (p.imagen) {
                            <img [src]="p.imagen" [alt]="" class="table-thumb-img" />
                          } @else {
                            <div class="table-thumb-ph" aria-hidden="true">◇</div>
                          }
                        </td>
                        <td class="td-name" [class.stock-bajo]="esStockBajo(p)">{{ p.nombre }}</td>
                        <td class="td-code">{{ p.codigo }}</td>
                        <td>{{ p.categoriaNombre ?? '—' }}</td>
                        <td class="col-num">{{ p.cantidad }}</td>
                        <td class="col-num td-price">
                          @if (p.precio != null) {
                            {{ p.precio | currency: companyCurrency() }}
                          } @else {
                            —
                          }
                        </td>
                        <td class="td-actions" data-stop-nav (click)="$event.stopPropagation()">
                          <div class="product-item-menu-root table-kebab">
                            <button
                              type="button"
                              class="card-kebab"
                              [class.open]="itemMenuId() === p.id"
                              [attr.aria-expanded]="itemMenuId() === p.id"
                              aria-haspopup="menu"
                              aria-label="Más acciones"
                              (click)="toggleItemMenu(p.id, $event)"
                            >
                              <svg class="card-kebab-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="5" r="2" fill="currentColor" />
                                <circle cx="12" cy="12" r="2" fill="currentColor" />
                                <circle cx="12" cy="19" r="2" fill="currentColor" />
                              </svg>
                            </button>
                            @if (itemMenuId() === p.id) {
                              <div class="card-dropdown card-dropdown--left" role="menu">
                                <button
                                  type="button"
                                  role="menuitem"
                                  class="card-dd-item"
                                  (click)="openHistorial(p)"
                                >
                                  Historial de stock
                                </button>
                                @if (canDeleteProduct()) {
                                  <button
                                    type="button"
                                    role="menuitem"
                                    class="card-dd-item danger"
                                    (click)="confirmDeleteFromMenu(p)"
                                  >
                                    Eliminar
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        }
      } @else {
        <p class="loading">Cargando…</p>
      }
    </div>

    <dialog #historialDialog class="modal historial-modal" (cancel)="$event.preventDefault()">
      <div class="modal-inner historial-inner">
        <h3>Historial de stock — {{ historialTitulo() }}</h3>
        @if (historialLoading()) {
          <p class="historial-muted">Cargando…</p>
        } @else if (historialRows().length === 0) {
          <p class="historial-muted">No hay movimientos registrados.</p>
        } @else {
          <div class="historial-table-wrap">
            <table class="historial-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th class="num">Cant.</th>
                  <th>Usuario</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                @for (m of historialRows(); track m.id) {
                  <tr>
                    <td>{{ m.fecha | date: 'short' }}</td>
                    <td>
                      <span class="historial-tipo" [class.historial-tipo--in]="m.tipo === 'ENTRADA'" [class.historial-tipo--out]="m.tipo === 'SALIDA'">
                        {{ historialTipoLabel(m.tipo) }}
                      </span>
                    </td>
                    <td class="num historial-qty" [class.historial-qty--in]="m.tipo === 'ENTRADA'" [class.historial-qty--out]="m.tipo === 'SALIDA'">
                      {{ movCantidadDisplay(m) }}
                    </td>
                    <td>{{ m.usuario }}</td>
                    <td>{{ m.observacion ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <div class="modal-actions">
          <button type="button" class="btn-secondary" (click)="closeHistorial()">Cerrar</button>
        </div>
      </div>
    </dialog>

    <dialog #productDialog class="modal" (cancel)="$event.preventDefault()">
      <div class="modal-inner">
        <h3>{{ dialogTitle() }}</h3>
        <form [formGroup]="form" (ngSubmit)="save()">
          <label>
            Nombre
            <input type="text" formControlName="nombre" />
          </label>
          <label>
            Cantidad
            <input type="number" formControlName="cantidad" min="0" step="1" />
          </label>
          <label>
            Precio
            <input type="number" formControlName="precio" min="0" step="0.01" />
          </label>
          <label>
            Stock mínimo (opcional)
            <input
              type="number"
              formControlName="stockMinimo"
              min="0"
              step="1"
              placeholder="Sin umbral"
            />
            <span class="field-hint">Si la cantidad es menor, el nombre se muestra en rojo.</span>
          </label>
          <label>
            Notas (opcional)
            <textarea formControlName="descripcion" rows="3" placeholder="Observaciones sobre el producto"></textarea>
          </label>
          <label class="photo-field">
            <span class="photo-field-label">Foto</span>
            <div class="photo-upload">
              <div class="photo-upload-inner">
                <svg
                  class="photo-upload-icon"
                  width="24"
                  height="24"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M4.75 3A3.761 3.761 0 001 6.75v8a3.761 3.761 0 003.75 3.75h6.75c0-.515.056-1.017.161-1.5H8.214l5.05-4.886v.001a.406.406 0 01.284-.119c.1 0 .202.04.284.12v-.002l.664.643c.429-.299.892-.551 1.383-.75l-1.004-.97a1.903 1.903 0 00-1.326-.533c-.48 0-.96.178-1.326.532h-.001l-1.05 1.015-2.597-2.514a1.906 1.906 0 00-1.327-.532c-.48 0-.96.177-1.326.532L2.5 12.847V6.75c0-1.252.998-2.25 2.25-2.25h12c1.252 0 2.25.998 2.25 2.25v4.768c.518.036 1.02.129 1.5.272V6.75A3.761 3.761 0 0016.75 3h-12zm1.257 16.5h5.564c.074.52.206 1.023.389 1.5H9a3.742 3.742 0 01-2.993-1.5zM23 8.25v4.888a7.005 7.005 0 00-1.5-.964V5.257c.909.685 1.5 1.77 1.5 2.993zM15.25 6.5a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zm-8.001 3.996c.1 0 .201.04.283.12l2.563 2.478L6.057 17H4.75a2.23 2.23 0 01-2.233-2.082l4.448-4.303a.408.408 0 01.284-.119zM13 18.5a5.5 5.5 0 1111 0 5.5 5.5 0 01-11 0zm6-3.5a.5.5 0 00-1 0v3h-3a.5.5 0 000 1h3v3a.5.5 0 001 0v-3h3a.5.5 0 000-1h-3v-3z"
                  />
                </svg>
                <span class="photo-upload-hint">(1 imagen, máx. 5 MB)</span>
              </div>
              <input
                type="file"
                class="photo-upload-input"
                aria-label="Subir foto del producto"
                accept="image/jpeg,image/jpg,image/jfif,image/png,image/gif,image/webp"
                (change)="onFile($event)"
              />
            </div>
          </label>
          @if (formError()) {
            <p class="error">{{ formError() }}</p>
          }
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeDialog()">Cancelar</button>
            <button type="submit" class="btn-submit" [disabled]="form.invalid || saving()">Guardar</button>
          </div>
        </form>
      </div>
    </dialog>
  `,
  styles: `
    :host {
      --inv-cta: #b91c1c;
      --inv-cta-hover: #991b1b;
      --inv-surface: #ffffff;
      --inv-border: #e8e8e8;
      --inv-muted: #6b7280;
      --inv-page: #f3f4f6;
      --inv-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
      --inv-shadow-hover: 0 4px 14px rgba(0, 0, 0, 0.1);
      display: block;
    }

    .productos-page {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 0 2rem;
    }

    .page-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }

    .page-title {
      margin: 0;
      font-size: clamp(1.5rem, 3vw, 1.85rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #111827;
    }

    .btn-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 1.1rem;
      border: none;
      border-radius: 4px;
      background: var(--inv-cta);
      color: #fff;
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      cursor: pointer;
      transition: background 0.15s ease, box-shadow 0.15s ease;
      box-shadow: var(--inv-shadow);
    }

    .btn-cta:hover {
      background: var(--inv-cta-hover);
      box-shadow: var(--inv-shadow-hover);
    }

    .toolbar-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .search-wrap {
      position: relative;
      flex: 1;
      min-width: 200px;
      max-width: 28rem;
    }

    .search-icon {
      position: absolute;
      left: 0.85rem;
      top: 50%;
      transform: translateY(-50%);
      color: var(--inv-muted);
      font-size: 1rem;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 0.65rem 0.85rem 0.65rem 2.25rem;
      border: 1px solid var(--inv-border);
      border-radius: 999px;
      background: var(--inv-surface);
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .search-input:focus {
      border-color: #c4c4c4;
      box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.12);
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      position: relative;
    }

    .sort-toolbar-label {
      font-size: 0.85rem;
      color: var(--inv-muted);
      font-weight: 500;
    }

    .sort-dropdown {
      position: relative;
    }

    .sort-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.65rem 0.45rem 0.85rem;
      border: 1px solid var(--inv-border);
      border-radius: 6px;
      background: var(--inv-surface);
      font-size: 0.875rem;
      cursor: pointer;
      color: #374151;
      min-width: 12rem;
      justify-content: space-between;
    }

    .sort-trigger:hover {
      border-color: #d1d5db;
    }

    .sort-trigger-main {
      font-weight: 500;
      text-align: left;
    }

    .sort-trigger-chev {
      color: var(--inv-muted);
      font-size: 0.65rem;
      line-height: 1;
    }

    .sort-panel {
      position: absolute;
      right: 0;
      top: calc(100% + 4px);
      min-width: 14rem;
      padding: 0.35rem 0;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 8px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
      z-index: 20;
    }

    .sort-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 0.75rem;
      padding: 0.55rem 1rem;
      border: none;
      background: transparent;
      font-size: 0.9rem;
      cursor: pointer;
      color: var(--inv-muted);
      text-align: left;
    }

    .sort-option:hover {
      background: #f9fafb;
    }

    .sort-option.active {
      color: var(--inv-cta);
      font-weight: 600;
    }

    .sort-option-label {
      flex: 1;
    }

    .sort-option-arrow {
      flex-shrink: 0;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--inv-cta);
    }

    .layout-dropdown {
      position: relative;
    }

    .layout-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      padding: 0;
      border: 1px solid #4b5563;
      border-radius: 8px;
      background: #374151;
      color: #fff;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .layout-trigger:hover {
      background: #4b5563;
      border-color: #6b7280;
    }

    .layout-trigger-icon {
      width: 1.25rem;
      height: 1.25rem;
      display: block;
    }

    .layout-panel {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      min-width: 12.5rem;
      padding: 0.5rem 0 0.35rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 10px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
      z-index: 25;
    }

    .layout-panel-title {
      padding: 0 0.85rem 0.4rem;
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9ca3af;
    }

    .layout-option {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      width: 100%;
      padding: 0.55rem 0.85rem;
      border: none;
      background: transparent;
      font-size: 0.9rem;
      cursor: pointer;
      color: #6b7280;
      text-align: left;
    }

    .layout-option:hover {
      background: #f9fafb;
    }

    .layout-option.active {
      background: #f3f4f6;
      color: #111827;
      font-weight: 600;
    }

    .layout-option-icon {
      flex-shrink: 0;
      width: 1.15rem;
      height: 1.15rem;
      color: #9ca3af;
    }

    .layout-option.active .layout-option-icon {
      color: var(--inv-cta);
    }

    .layout-option-label {
      flex: 1;
    }

    .stats-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem 2.5rem;
      padding: 0.85rem 0;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--inv-border);
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .stat-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--inv-muted);
    }

    .stat-value {
      font-size: 1.05rem;
      font-weight: 700;
      color: #111827;
    }

    .loading,
    .empty-hint {
      color: var(--inv-muted);
      padding: 2rem 0;
      text-align: center;
    }

    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1.25rem;
    }

    @media (min-width: 900px) {
      .card-grid {
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      }
    }

    .product-card {
      background: var(--inv-surface);
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--inv-border);
      box-shadow: var(--inv-shadow);
      transition: box-shadow 0.2s ease, transform 0.2s ease;
    }

    .product-card--click {
      cursor: pointer;
    }

    .product-card--click:hover {
      box-shadow: var(--inv-shadow-hover);
      transform: translateY(-2px);
    }

    .card-image-wrap {
      position: relative;
      aspect-ratio: 4 / 3;
      background: #eceef1;
    }

    .card-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .card-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(145deg, #e8eaed, #f1f3f5);
    }

    .placeholder-icon {
      font-size: 2rem;
      color: #c5c9d0;
      opacity: 0.9;
    }

    .card-title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.35rem;
    }

    .card-title-row .card-title {
      flex: 1;
      min-width: 0;
    }

    .product-item-menu-root {
      position: relative;
      flex-shrink: 0;
    }

    .card-kebab {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.85rem;
      height: 1.85rem;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      opacity: 0;
      transition:
        opacity 0.15s ease,
        background 0.15s ease;
    }

    .product-card:hover .card-kebab,
    .product-card .card-kebab.open,
    .product-list-row:hover .list-kebab .card-kebab,
    .list-kebab .card-kebab.open,
    .product-table-row:hover .table-kebab .card-kebab,
    .table-kebab .card-kebab.open {
      opacity: 1;
    }

    .card-kebab:hover,
    .card-kebab:focus-visible {
      background: #f3f4f6;
      color: #374151;
    }

    .card-kebab-icon {
      width: 1.1rem;
      height: 1.1rem;
      display: block;
    }

    .card-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      min-width: 11rem;
      padding: 0.35rem 0;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 8px;
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.12);
      z-index: 30;
    }

    .card-dropdown--left {
      right: auto;
      left: 0;
    }

    .list-kebab .card-dropdown,
    .table-kebab .card-dropdown {
      right: 0;
      left: auto;
    }

    .card-dd-item {
      display: block;
      width: 100%;
      padding: 0.5rem 0.85rem;
      border: none;
      background: transparent;
      font-size: 0.88rem;
      text-align: left;
      cursor: pointer;
      color: #374151;
    }

    .card-dd-item:hover {
      background: #f9fafb;
    }

    .card-dd-item.danger {
      color: var(--inv-cta);
    }

    .card-sep {
      margin: 0 0.35rem;
      color: #d1d5db;
      font-weight: 400;
    }

    .list-kebab {
      align-self: center;
    }

    .product-table-row {
      cursor: pointer;
    }

    .historial-modal {
      max-width: 40rem;
      width: calc(100vw - 2rem);
    }

    .historial-inner h3 {
      margin-top: 0;
    }

    .historial-muted {
      color: var(--inv-muted);
      margin: 0.5rem 0 0;
    }

    .historial-table-wrap {
      overflow-x: auto;
      margin: 0.75rem 0 0;
      max-height: min(50vh, 360px);
      overflow-y: auto;
    }

    .historial-table {
      width: 100%;
      min-width: 420px;
      border-collapse: collapse;
      font-size: 0.82rem;
    }

    .historial-table th,
    .historial-table td {
      padding: 0.4rem 0.5rem;
      border-bottom: 1px solid #f3f4f6;
      text-align: left;
    }

    .historial-table th {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--inv-muted);
    }

    .historial-table .num {
      text-align: right;
    }

    .historial-tipo {
      font-weight: 600;
    }

    .historial-tipo--in {
      color: #15803d;
    }

    .historial-tipo--out {
      color: #b91c1c;
    }

    .historial-qty {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    .historial-qty--in {
      color: #15803d;
    }

    .historial-qty--out {
      color: #b91c1c;
    }

    .icon-btn {
      padding: 0.25rem 0.45rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border: none;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.92);
      color: #374151;
      cursor: pointer;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
    }

    .icon-btn:hover {
      background: #fff;
    }

    .icon-btn.danger {
      color: var(--inv-cta);
    }

    .card-body {
      padding: 0.75rem 0.85rem 0.9rem;
    }

    .card-title {
      margin: 0 0 0.25rem;
      font-size: 0.95rem;
      font-weight: 700;
      line-height: 1.3;
      color: #111827;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-title.stock-bajo {
      color: var(--inv-cta);
    }

    .card-meta {
      margin: 0 0 0.5rem;
      font-size: 0.72rem;
      color: var(--inv-muted);
    }

    .card-code {
      font-family: ui-monospace, monospace;
    }

    .card-footer {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
      font-size: 0.8rem;
      color: var(--inv-muted);
    }

    .card-qty {
      font-weight: 500;
    }

    .card-price {
      font-weight: 700;
      color: #111827;
    }

    .product-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .product-list-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.85rem 1rem;
      padding: 0.75rem 0.85rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 10px;
      box-shadow: var(--inv-shadow);
      cursor: pointer;
    }

    .list-thumb {
      flex-shrink: 0;
      width: 4.5rem;
      height: 3.4rem;
      border-radius: 8px;
      overflow: hidden;
      background: #eceef1;
    }

    .list-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .list-thumb-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      color: #c5c9d0;
      background: linear-gradient(145deg, #e8eaed, #f1f3f5);
    }

    .list-main {
      flex: 1;
      min-width: 0;
    }

    .list-title {
      margin: 0 0 0.2rem;
      font-size: 0.95rem;
      font-weight: 700;
      line-height: 1.3;
      color: #111827;
    }

    .list-title.stock-bajo {
      color: var(--inv-cta);
    }

    .list-meta {
      margin: 0;
      font-size: 0.75rem;
      color: var(--inv-muted);
    }

    .list-cat {
      color: #9ca3af;
    }

    .list-stats {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.15rem;
      font-size: 0.82rem;
      color: var(--inv-muted);
    }

    .list-qty {
      font-weight: 500;
    }

    .list-price {
      font-weight: 700;
      color: #111827;
    }

    .list-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .list-action-btn {
      padding: 0.3rem 0.5rem;
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      border: none;
      border-radius: 4px;
      background: #f3f4f6;
      color: #374151;
      cursor: pointer;
    }

    .list-action-btn:hover {
      background: #e5e7eb;
    }

    .list-action-btn.danger {
      color: var(--inv-cta);
    }

    .table-scroll {
      overflow-x: auto;
      margin: 0 -0.25rem;
      padding: 0 0.25rem;
    }

    .product-table {
      width: 100%;
      min-width: 640px;
      border-collapse: collapse;
      font-size: 0.875rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: var(--inv-shadow);
    }

    .product-table thead {
      background: #f9fafb;
      border-bottom: 1px solid var(--inv-border);
    }

    .product-table th {
      padding: 0.65rem 0.75rem;
      text-align: left;
      font-size: 0.72rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--inv-muted);
    }

    .product-table td {
      padding: 0.55rem 0.75rem;
      border-bottom: 1px solid #f3f4f6;
      vertical-align: middle;
    }

    .product-table tbody tr:last-child td {
      border-bottom: none;
    }

    .product-table tbody tr:hover {
      background: #fafafa;
    }

    .col-thumb {
      width: 3.25rem;
    }

    .col-num {
      text-align: right;
      white-space: nowrap;
    }

    .col-actions {
      width: 1%;
      white-space: nowrap;
    }

    .td-thumb {
      width: 3.25rem;
    }

    .table-thumb-img {
      width: 2.5rem;
      height: 2.5rem;
      object-fit: cover;
      border-radius: 6px;
      display: block;
    }

    .table-thumb-ph {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 6px;
      background: #eceef1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      color: #c5c9d0;
    }

    .td-name {
      font-weight: 600;
      color: #111827;
      max-width: 14rem;
    }

    .td-name.stock-bajo {
      color: var(--inv-cta);
    }

    .td-code {
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      color: var(--inv-muted);
    }

    .td-price {
      font-weight: 600;
      color: #111827;
    }

    .td-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .table-action-btn {
      padding: 0.25rem 0.45rem;
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
      border: none;
      border-radius: 4px;
      background: #f3f4f6;
      color: #374151;
      cursor: pointer;
    }

    .table-action-btn.danger {
      color: var(--inv-cta);
    }

    .row-stock-bajo {
      background: #fff5f5;
    }

    .modal {
      border: none;
      border-radius: 12px;
      padding: 0;
      max-width: 26rem;
      width: calc(100vw - 2rem);
    }

    .modal::backdrop {
      background: rgba(0, 0, 0, 0.45);
    }

    .modal-inner {
      padding: 1.35rem;
    }

    .modal h3 {
      margin: 0 0 1rem;
      font-size: 1.15rem;
      font-weight: 700;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    input[type='text'],
    input[type='number'],
    textarea {
      padding: 0.5rem 0.6rem;
      border: 1px solid var(--inv-border);
      border-radius: 6px;
      font: inherit;
      resize: vertical;
      min-height: 4rem;
    }

    .photo-field {
      gap: 0.4rem;
    }

    .photo-field-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .photo-upload {
      position: relative;
      width: 100%;
      min-height: 5.5rem;
      border: 2px dashed var(--inv-border);
      border-radius: 8px;
      background: #fafafa;
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }

    .photo-upload:hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }

    .photo-upload:focus-within {
      border-color: #c4c4c4;
      box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.12);
      outline: none;
    }

    .photo-upload-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.95rem 0.75rem;
      pointer-events: none;
      color: var(--inv-muted);
    }

    .photo-upload-icon {
      flex-shrink: 0;
      opacity: 0.9;
    }

    .photo-upload-hint {
      font-size: 0.72rem;
      font-weight: 500;
      text-align: center;
      line-height: 1.35;
      color: var(--inv-muted);
    }

    .photo-upload-input {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      opacity: 0.001;
      cursor: pointer;
      font-size: 0;
    }

    .field-hint {
      font-size: 0.72rem;
      font-weight: 400;
      color: var(--inv-muted);
      margin-top: 0.15rem;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.85rem;
    }

    .btn-secondary {
      padding: 0.5rem 0.95rem;
      border-radius: 6px;
      border: 1px solid var(--inv-border);
      background: #fff;
      cursor: pointer;
      font-weight: 500;
    }

    .btn-submit {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      background: var(--inv-cta);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-submit:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .error {
      color: #b00020;
      font-size: 0.85rem;
      margin: 0;
    }
  `,
})
export class ProductosComponent {
  private readonly api = inject(CatalogoApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  private readonly reload$ = new BehaviorSubject(0);
  private readonly search$ = new BehaviorSubject('');

  protected readonly searchTerm = signal('');

  /** Criterio activo: primer clic en un criterio usa dirección por defecto; segundo clic en el mismo alterna asc/desc. */
  protected readonly sortState = signal<SortState>({ field: 'name', dir: 'asc' });
  protected readonly sortMenuOpen = signal(false);

  /** Menú ⋮ por producto (grid/lista/tabla). */
  protected readonly itemMenuId = signal<number | null>(null);
  protected readonly historialTitulo = signal('');
  protected readonly historialLoading = signal(false);
  protected readonly historialRows = signal<MovimientoStockDto[]>([]);

  protected readonly layoutMode = signal<LayoutMode>(readStoredLayout());
  protected readonly layoutMenuOpen = signal(false);
  protected readonly layoutOptions = [
    { mode: 'grid' as const, label: 'Cuadrícula' },
    { mode: 'list' as const, label: 'Lista' },
    { mode: 'table' as const, label: 'Tabla' },
  ];

  protected readonly sortOptions = [
    { field: 'name' as const, label: 'Nombre' },
    { field: 'updated' as const, label: 'Última actualización' },
    { field: 'quantity' as const, label: 'Cantidad' },
    { field: 'price' as const, label: 'Precio' },
  ];

  private readonly sortState$ = toObservable(this.sortState);

  protected readonly pageData$ = combineLatest([
    this.reload$.pipe(switchMap(() => this.api.getProductos())),
    this.search$,
    this.sortState$,
  ]).pipe(
    map((args) => {
      const [list, q, sort] = args as [ProductoDto[], string, SortState];
      return this.buildPageData(list, q, sort);
    }),
  );

  private readonly sortDropdownRef = viewChild<ElementRef<HTMLElement>>('sortDropdown');
  private readonly layoutDropdownRef = viewChild<ElementRef<HTMLElement>>('layoutDropdown');
  private readonly historialDialogRef = viewChild<ElementRef<HTMLDialogElement>>('historialDialog');
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('productDialog');

  protected readonly editingId = signal<number | null>(null);
  protected readonly dialogTitle = signal('Nuevo producto');
  protected readonly formError = signal('');
  protected readonly saving = signal(false);

  private file: File | null = null;

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control('', Validators.required),
    cantidad: this.fb.nonNullable.control(0, {
      validators: [Validators.required, Validators.min(0)],
    }),
    precio: this.fb.nonNullable.control(0, {
      validators: [Validators.required, Validators.min(0)],
    }),
    stockMinimo: this.fb.control<number | null>(null),
    descripcion: this.fb.nonNullable.control(''),
  });

  protected companyCurrency(): string {
    return this.auth.currentUser()?.companyCurrency ?? 'EUR';
  }

  protected esStockBajo(p: ProductoDto): boolean {
    if (p.stockMinimo == null) {
      return false;
    }
    return p.cantidad < p.stockMinimo;
  }

  protected onSearch(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.searchTerm.set(v);
    this.search$.next(v);
  }

  protected sortTriggerText(): string {
    const s = this.sortState();
    const label = this.sortOptions.find((o) => o.field === s.field)?.label ?? '';
    const arrow = s.dir === 'desc' ? '↓' : '↑';
    return `${label} ${arrow}`;
  }

  protected goToProducto(id: number, ev: MouseEvent): void {
    const el = ev.target as HTMLElement | null;
    if (el?.closest?.('[data-stop-nav]')) {
      return;
    }
    void this.router.navigate(['/producto', id]);
  }

  protected toggleItemMenu(id: number, ev: Event): void {
    ev.stopPropagation();
    this.itemMenuId.update((cur) => (cur === id ? null : id));
  }

  protected openHistorial(p: ProductoDto): void {
    this.itemMenuId.set(null);
    this.historialTitulo.set(p.nombre);
    this.historialLoading.set(true);
    this.historialRows.set([]);
    this.api.getProductoMovimientos(p.id).subscribe({
      next: (rows) => {
        this.historialRows.set(rows);
        this.historialLoading.set(false);
        queueMicrotask(() => this.historialDialogRef()?.nativeElement.showModal());
      },
      error: () => {
        this.historialLoading.set(false);
        globalThis.alert('No se pudo cargar el historial');
      },
    });
  }

  protected closeHistorial(): void {
    this.historialDialogRef()?.nativeElement.close();
  }

  protected historialTipoLabel(tipo: string): string {
    switch (tipo) {
      case 'ENTRADA':
        return 'Entrada';
      case 'SALIDA':
        return 'Salida';
      case 'AJUSTE':
        return 'Ajuste';
      default:
        return tipo;
    }
  }

  /** Cantidad con signo según tipo (entrada +n, salida −n). */
  protected movCantidadDisplay(m: MovimientoStockDto): string {
    switch (m.tipo) {
      case 'ENTRADA':
        return `+${m.cantidad}`;
      case 'SALIDA':
        return `−${m.cantidad}`;
      default:
        return String(m.cantidad);
    }
  }

  protected confirmDeleteFromMenu(p: ProductoDto): void {
    this.itemMenuId.set(null);
    this.confirmDelete(p);
  }

  protected layoutLabel(): string {
    const m = this.layoutMode();
    if (m === 'grid') return 'Cuadrícula';
    if (m === 'list') return 'Lista';
    return 'Tabla';
  }

  protected toggleLayoutMenu(ev: Event): void {
    ev.stopPropagation();
    this.layoutMenuOpen.update((open: boolean) => !open);
    if (this.layoutMenuOpen()) {
      this.sortMenuOpen.set(false);
    }
  }

  protected selectLayout(mode: LayoutMode): void {
    this.layoutMode.set(mode);
    try {
      localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    this.layoutMenuOpen.set(false);
  }

  protected toggleSortMenu(ev: Event): void {
    ev.stopPropagation();
    this.sortMenuOpen.update((open: boolean) => !open);
    if (this.sortMenuOpen()) {
      this.layoutMenuOpen.set(false);
    }
  }

  protected selectSortField(field: SortField): void {
    const cur = this.sortState();
    const next: SortState =
      cur.field === field
        ? { field, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
        : { field, dir: this.defaultDirForField(field) };
    this.sortState.set(next);
    this.sortMenuOpen.set(false);
  }

  private defaultDirForField(field: SortField): SortDir {
    switch (field) {
      case 'name':
        return 'asc';
      case 'updated':
      case 'quantity':
      case 'price':
        return 'desc';
      default:
        return 'desc';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const t = ev.target as Node;
    const el = ev.target as HTMLElement | null;
    if (this.sortMenuOpen()) {
      const sortRoot = this.sortDropdownRef()?.nativeElement;
      if (sortRoot && !sortRoot.contains(t)) {
        this.sortMenuOpen.set(false);
      }
    }
    if (this.layoutMenuOpen()) {
      const layoutRoot = this.layoutDropdownRef()?.nativeElement;
      if (layoutRoot && !layoutRoot.contains(t)) {
        this.layoutMenuOpen.set(false);
      }
    }
    if (this.itemMenuId() !== null) {
      if (!el?.closest?.('.product-item-menu-root')) {
        this.itemMenuId.set(null);
      }
    }
  }

  private buildPageData(list: ProductoDto[], q: string, sort: SortState): ProductosPageData {
    const totalQty = list.reduce((s, p) => s + (p.cantidad ?? 0), 0);
    const totalValue = list.reduce((s, p) => {
      const price = p.precio != null ? Number(p.precio) : 0;
      return s + price * (p.cantidad ?? 0);
    }, 0);

    const qq = q.trim().toLowerCase();
    let items = [...list];
    if (qq) {
      items = items.filter(
        (p) =>
          p.nombre.toLowerCase().includes(qq) ||
          p.codigo.toLowerCase().includes(qq) ||
          (p.categoriaNombre?.toLowerCase().includes(qq) ?? false),
      );
    }
    switch (sort.field) {
      case 'name':
        items.sort((a, b) => {
          const c = a.nombre.localeCompare(b.nombre, 'es');
          return sort.dir === 'asc' ? c : -c;
        });
        break;
      case 'updated':
        items.sort((a, b) => {
          const ta = new Date(a.fechaActualizacion).getTime();
          const tb = new Date(b.fechaActualizacion).getTime();
          return sort.dir === 'desc' ? tb - ta : ta - tb;
        });
        break;
      case 'quantity':
        items.sort((a, b) => {
          const ca = a.cantidad ?? 0;
          const cb = b.cantidad ?? 0;
          return sort.dir === 'desc' ? cb - ca : ca - cb;
        });
        break;
      case 'price':
        items.sort((a, b) => {
          const va = this.priceSortValue(a, sort.dir);
          const vb = this.priceSortValue(b, sort.dir);
          return sort.dir === 'desc' ? vb - va : va - vb;
        });
        break;
    }

    return {
      items,
      itemCount: list.length,
      totalQty,
      totalValue,
    };
  }

  private priceSortValue(p: ProductoDto, dir: SortDir): number {
    if (p.precio != null) {
      return Number(p.precio);
    }
    return dir === 'desc' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }

  protected refreshList(): void {
    this.reload$.next(this.reload$.value + 1);
  }

  protected openCreate(): void {
    if (!this.canCreateProduct()) {
      return;
    }
    this.editingId.set(null);
    this.dialogTitle.set('Nuevo producto');
    this.form.reset({ nombre: '', cantidad: 0, precio: 0, stockMinimo: null, descripcion: '' });
    this.file = null;
    this.formError.set('');
    this.dialogRef()?.nativeElement.showModal();
  }

  protected openEdit(p: ProductoDto): void {
    this.editingId.set(p.id);
    this.dialogTitle.set('Editar producto');
    this.form.patchValue({
      nombre: p.nombre,
      cantidad: p.cantidad,
      precio: p.precio ?? 0,
      stockMinimo: p.stockMinimo ?? null,
      descripcion: p.descripcion ?? '',
    });
    this.file = null;
    this.formError.set('');
    this.dialogRef()?.nativeElement.showModal();
  }

  protected closeDialog(): void {
    this.dialogRef()?.nativeElement.close();
  }

  protected onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    this.file = f ?? null;
  }

  protected save(): void {
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const payload = {
      nombre: v.nombre.trim(),
      cantidad: v.cantidad,
      precio: v.precio,
      stockMinimo: this.normalizeStockMinimo(v.stockMinimo),
      descripcion: typeof v.descripcion === 'string' ? v.descripcion.trim() : '',
      imagen: this.file,
    };
    this.formError.set('');
    this.saving.set(true);
    const id = this.editingId();
    const req$ =
      id == null ? this.api.createProducto(payload) : this.api.updateProducto(id, payload);
    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.refreshList();
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.saving.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Error al guardar';
        this.formError.set(typeof msg === 'string' ? msg : 'Error al guardar');
      },
    });
  }

  private normalizeStockMinimo(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) {
      return null;
    }
    return n < 0 ? null : Math.floor(n);
  }

  protected confirmDelete(p: ProductoDto): void {
    if (!this.canDeleteProduct()) {
      globalThis.alert('Tu rol no permite eliminar productos');
      return;
    }
    if (!globalThis.confirm(`¿Eliminar "${p.nombre}"?`)) {
      return;
    }
    this.api.deleteProducto(p.id).subscribe({
      next: () => this.refreshList(),
      error: () => globalThis.alert('No se pudo eliminar el producto'),
    });
  }

  protected canCreateProduct(): boolean {
    return this.auth.currentUser()?.companyRole === 'company_admin';
  }

  protected canDeleteProduct(): boolean {
    return this.auth.currentUser()?.companyRole === 'company_admin';
  }
}
