import { AsyncPipe, CurrencyPipe, DatePipe } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  forkJoin,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { CarpetaArbolDto, CategoriaDto, MovimientoStockDto, ProductoDto, formatProductoCategorias, productoCoincideCategoria } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogoApiService, ProductoFormPayload } from '../../core/services/catalogo-api.service';

interface ProductosPageData {
  items: ProductoDto[];
  itemCount: number;
  totalQty: number;
  totalValue: number;
}

/** Subcarpeta con totales recursivos (uds. y valor). */
interface CarpetaSubcarpetaVm extends CarpetaArbolDto {
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

function carpetasEnNivel(arbol: CarpetaArbolDto[], carpetaActualId: number | null): CarpetaArbolDto[] {
  if (carpetaActualId === null) {
    return arbol;
  }
  const queue = [...arbol];
  while (queue.length) {
    const n = queue.shift()!;
    if (n.id === carpetaActualId) {
      return n.hijos ?? [];
    }
    queue.push(...(n.hijos ?? []));
  }
  return [];
}

function findCarpetaNode(nodes: CarpetaArbolDto[], id: number): CarpetaArbolDto | null {
  for (const n of nodes) {
    if (n.id === id) {
      return n;
    }
    const ch = findCarpetaNode(n.hijos ?? [], id);
    if (ch) {
      return ch;
    }
  }
  return null;
}

function collectCarpetaSubtreeIds(nodes: CarpetaArbolDto[], rootId: number): Set<number> {
  const root = findCarpetaNode(nodes, rootId);
  const out = new Set<number>();
  if (!root) {
    out.add(rootId);
    return out;
  }
  const walk = (n: CarpetaArbolDto) => {
    out.add(n.id);
    for (const h of n.hijos ?? []) {
      walk(h);
    }
  };
  walk(root);
  return out;
}

function pathToFolder(nodes: CarpetaArbolDto[], targetId: number): { id: number; nombre: string }[] {
  for (const n of nodes) {
    if (n.id === targetId) {
      return [{ id: n.id, nombre: n.nombre }];
    }
    const sub = pathToFolder(n.hijos ?? [], targetId);
    if (sub.length) {
      return [{ id: n.id, nombre: n.nombre }, ...sub];
    }
  }
  return [];
}

interface CarpetaTreeRow {
  id: number;
  nombre: string;
  depth: number;
}

/** Lista plana del árbol con profundidad para el panel lateral (indentación). */
function flattenCarpetasForTree(nodes: CarpetaArbolDto[], depth = 0): CarpetaTreeRow[] {
  const rows: CarpetaTreeRow[] = [];
  for (const n of nodes) {
    rows.push({ id: n.id, nombre: n.nombre, depth });
    rows.push(...flattenCarpetasForTree(n.hijos ?? [], depth + 1));
  }
  return rows;
}

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [AsyncPipe, DatePipe, CurrencyPipe, ReactiveFormsModule],
  template: `
    <div class="productos-page">
      <div class="productos-layout">
        <aside class="productos-tree" aria-label="Árbol de carpetas">
          <div class="productos-tree-title">Carpetas</div>
          <nav class="productos-tree-nav">
            <button
              type="button"
              class="tree-row tree-row--root"
              [class.tree-row--active]="currentCarpetaId() === null"
              (click)="treeGoTo(null)"
            >
              <span class="tree-row-icon" aria-hidden="true">
                <svg class="tree-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                    d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"
                  />
                </svg>
              </span>
              <span class="tree-row-label">Todos los productos</span>
            </button>
            @for (row of flatFolderTree(); track row.id) {
              <button
                type="button"
                class="tree-row"
                [class.tree-row--active]="currentCarpetaId() === row.id"
                [style.padding-left.px]="10 + row.depth * 16"
                (click)="treeGoTo(row.id)"
              >
                <span class="tree-row-icon" aria-hidden="true">
                  <svg class="tree-icon-svg tree-icon-svg--muted" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                      d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"
                    />
                  </svg>
                </span>
                <span class="tree-row-label">{{ row.nombre }}</span>
              </button>
            }
          </nav>
        </aside>
        <div class="productos-main">
          <header class="page-head">
        <div class="page-head-text">
          <h1 class="page-title">Productos</h1>
          <p class="page-sub">Tu catálogo y carpetas, todo a mano.</p>
        </div>
        <div class="page-head-actions">
          @if (canManageFolders()) {
            <button type="button" class="btn-secondary-header" (click)="openCreateFolder()">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2zM12 11v6M9 14h6" />
              </svg>
              Nueva carpeta
            </button>
          }
          @if (canCreateProduct()) {
            <button type="button" class="btn-cta" (click)="openCreate()">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
              </svg>
              Añadir producto
            </button>
          }
        </div>
      </header>

      <nav class="folder-bc" aria-label="Ubicación">
        <span class="folder-bc-home" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 12l9-8 9 8M5 10v10h14V10" />
          </svg>
        </span>
        @for (crumb of breadcrumbs(); track idx; let idx = $index) {
          @if (idx > 0) {
            <span class="folder-bc-sep" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="12" height="12">
                <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6" />
              </svg>
            </span>
          }
          <button type="button" class="folder-bc-link" [class.folder-bc-link--current]="idx === breadcrumbs().length - 1" (click)="goBreadcrumb(idx)">{{ crumb.nombre }}</button>
        }
      </nav>

      <section class="toolbar-strip">
        <div class="search-wrap">
          <span class="search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </span>
          <input
            type="search"
            class="search-input"
            placeholder="Buscar productos"
            [value]="searchTerm()"
            (input)="onSearch($event)"
          />
        </div>
        <label class="cat-filter">
          <span class="cat-filter-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </svg>
          </span>
          <select
            class="cat-filter-select"
            [value]="categoriaFiltro() != null ? '' + categoriaFiltro() : ''"
            (change)="onCategoriaFiltroChange($event)"
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            @for (c of categorias(); track c.id) {
              <option [value]="'' + c.id">{{ c.nombre }}</option>
            }
          </select>
        </label>
        <div class="toolbar-right">
          <div class="layout-segmented" role="tablist" aria-label="Tipo de vista" #layoutDropdown>
            @for (opt of layoutOptions; track opt.mode) {
              <button
                type="button"
                class="layout-seg-btn"
                role="tab"
                [class.active]="layoutMode() === opt.mode"
                [attr.aria-selected]="layoutMode() === opt.mode"
                [attr.aria-label]="opt.label"
                [title]="opt.label"
                (click)="selectLayout(opt.mode)"
              >
                @switch (opt.mode) {
                  @case ('grid') {
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="currentColor" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="currentColor" />
                    </svg>
                  }
                  @case ('list') {
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="5" rx="1.5" fill="currentColor" />
                      <rect x="3" y="14" width="18" height="5" rx="1.5" fill="currentColor" />
                    </svg>
                  }
                  @case ('table') {
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="3.5" rx="0.8" fill="currentColor" />
                      <rect x="3" y="10.25" width="18" height="3.5" rx="0.8" fill="currentColor" />
                      <rect x="3" y="16.5" width="18" height="3.5" rx="0.8" fill="currentColor" />
                    </svg>
                  }
                }
              </button>
            }
          </div>
          <div class="sort-dropdown" #sortDropdown>
            <button
              type="button"
              class="sort-trigger"
              [attr.aria-expanded]="sortMenuOpen()"
              aria-haspopup="listbox"
              (click)="toggleSortMenu($event)"
            >
              <svg class="sort-trigger-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 6h13M3 12h9M3 18h5M17 4v16M17 20l3-3M17 20l-3-3" />
              </svg>
              <span class="sort-trigger-main">{{ sortTriggerText() }}</span>
              <svg class="sort-trigger-chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="m6 9 6 6 6-6" />
              </svg>
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

      @if (vm$ | async; as vm) {
        @switch (layoutMode()) {
          @case ('grid') {
            @if (vm.subcarpetas.length > 0) {
              <section class="folder-block card-grid" aria-label="Subcarpetas">
                @for (d of vm.subcarpetas; track d.id) {
                  <article class="product-card product-card--click folder-card" (click)="enterFolder(d, $event)">
                    <div class="card-image-wrap">
                      <div class="card-placeholder card-placeholder--folder" aria-hidden="true">
                          <svg class="folder-placeholder-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                            />
                          </svg>
                      </div>
                    </div>
                    <div class="card-body">
                      <div class="card-title-row">
                        <h2 class="card-title">{{ d.nombre }}</h2>
                        @if (canManageFolders()) {
                          <div class="folder-item-menu-root" data-stop-nav>
                            <button
                              type="button"
                              class="card-kebab"
                              [class.open]="folderMenuId() === d.id"
                              [attr.aria-expanded]="folderMenuId() === d.id"
                              aria-haspopup="menu"
                              aria-label="Más acciones en carpeta"
                              (click)="toggleFolderMenu(d.id, $event)"
                            >
                              <svg class="card-kebab-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="5" r="2" fill="currentColor" />
                                <circle cx="12" cy="12" r="2" fill="currentColor" />
                                <circle cx="12" cy="19" r="2" fill="currentColor" />
                              </svg>
                            </button>
                            @if (folderMenuId() === d.id) {
                              <div class="card-dropdown card-dropdown--left" role="menu">
                                <button type="button" role="menuitem" class="card-dd-item" (click)="renameFolderPrompt(d)">
                                  Renombrar
                                </button>
                                <button type="button" role="menuitem" class="card-dd-item" (click)="openMoveFolderDialog(d)">
                                  Mover…
                                </button>
                                <button type="button" role="menuitem" class="card-dd-item" (click)="cloneFolderConfirm(d)">
                                  Clonar carpeta
                                </button>
                                @if (canDeleteProduct()) {
                                  <button type="button" role="menuitem" class="card-dd-item danger" (click)="deleteFolderConfirm(d)">
                                    Eliminar carpeta
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        }
                      </div>
                      <p class="card-meta">
                        <span class="folder-meta-label">Carpeta</span>
                      </p>
                      <div class="card-footer">
                        <span class="card-qty">{{ d.totalQty }} {{ d.totalQty === 1 ? 'ud.' : 'uds.' }}</span>
                        <span class="card-sep">|</span>
                        <span class="card-price">{{ d.totalValue | currency: companyCurrency() }}</span>
                      </div>
                    </div>
                  </article>
                }
              </section>
            }
            <section class="stats-bar" aria-label="Resumen">
              <div class="stat">
                <span class="stat-icon stat-icon--blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Productos</span>
                  <span class="stat-value">{{ vm.pageData.itemCount }}</span>
                </div>
              </div>
              <div class="stat">
                <span class="stat-icon stat-icon--amber" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 7h-7L9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Cantidad total</span>
                  <span class="stat-value">{{ vm.pageData.totalQty }} uds.</span>
                </div>
              </div>
              <div class="stat">
                <span class="stat-icon stat-icon--green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Valor total</span>
                  <span class="stat-value">{{ vm.pageData.totalValue | currency: companyCurrency() }}</span>
                </div>
              </div>
            </section>
            @if (vm.pageData.items.length > 0) {
              <div class="card-grid">
                @for (p of vm.pageData.items; track p.id) {
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
                            <div class="card-dropdown card-dropdown--left" role="menu">
                              <button type="button" role="menuitem" class="card-dd-item" (click)="openHistorial(p)">
                                Historial de stock
                              </button>
                              @if (canEmployeeCatalog()) {
                                <button type="button" role="menuitem" class="card-dd-item" (click)="cloneProductFromMenu(p)">
                                  Clonar
                                </button>
                                <button type="button" role="menuitem" class="card-dd-item" (click)="openMoveProductDialog(p)">
                                  Mover a carpeta…
                                </button>
                              }
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
          }
          @case ('list') {
            @if (vm.subcarpetas.length > 0) {
              <section class="folder-block product-list" aria-label="Subcarpetas">
                @for (d of vm.subcarpetas; track d.id) {
                  <article class="product-list-row folder-list-row" (click)="enterFolder(d, $event)">
                    <div class="list-thumb">
                      <div class="list-thumb-placeholder list-thumb-placeholder--folder" aria-hidden="true">
                          <svg class="folder-placeholder-icon folder-placeholder-icon--sm" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                              fill="currentColor"
                              d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                            />
                          </svg>
                      </div>
                    </div>
                    <div class="list-main">
                      <h2 class="list-title">{{ d.nombre }}</h2>
                      <p class="list-meta"><span class="folder-meta-label">Carpeta</span></p>
                    </div>
                    <div class="list-stats">
                      <span class="list-qty">{{ d.totalQty }} {{ d.totalQty === 1 ? 'ud.' : 'uds.' }}</span>
                      <span class="list-price">{{ d.totalValue | currency: companyCurrency() }}</span>
                    </div>
                    @if (canManageFolders()) {
                      <div class="folder-item-menu-root list-kebab" data-stop-nav>
                        <button
                          type="button"
                          class="card-kebab"
                          [class.open]="folderMenuId() === d.id"
                          [attr.aria-expanded]="folderMenuId() === d.id"
                          aria-haspopup="menu"
                          aria-label="Más acciones en carpeta"
                          (click)="toggleFolderMenu(d.id, $event)"
                        >
                          <svg class="card-kebab-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="5" r="2" fill="currentColor" />
                            <circle cx="12" cy="12" r="2" fill="currentColor" />
                            <circle cx="12" cy="19" r="2" fill="currentColor" />
                          </svg>
                        </button>
                        @if (folderMenuId() === d.id) {
                          <div class="card-dropdown card-dropdown--left" role="menu">
                            <button type="button" role="menuitem" class="card-dd-item" (click)="renameFolderPrompt(d)">
                              Renombrar
                            </button>
                            <button type="button" role="menuitem" class="card-dd-item" (click)="openMoveFolderDialog(d)">
                              Mover…
                            </button>
                            <button type="button" role="menuitem" class="card-dd-item" (click)="cloneFolderConfirm(d)">
                              Clonar carpeta
                            </button>
                            @if (canDeleteProduct()) {
                              <button type="button" role="menuitem" class="card-dd-item danger" (click)="deleteFolderConfirm(d)">
                                Eliminar carpeta
                              </button>
                            }
                          </div>
                        }
                      </div>
                    }
                  </article>
                }
              </section>
            }
            <section class="stats-bar" aria-label="Resumen">
              <div class="stat">
                <span class="stat-icon stat-icon--blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Productos</span>
                  <span class="stat-value">{{ vm.pageData.itemCount }}</span>
                </div>
              </div>
              <div class="stat">
                <span class="stat-icon stat-icon--amber" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 7h-7L9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Cantidad total</span>
                  <span class="stat-value">{{ vm.pageData.totalQty }} uds.</span>
                </div>
              </div>
              <div class="stat">
                <span class="stat-icon stat-icon--green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Valor total</span>
                  <span class="stat-value">{{ vm.pageData.totalValue | currency: companyCurrency() }}</span>
                </div>
              </div>
            </section>
            @if (vm.pageData.items.length > 0) {
              <div class="product-list">
                @for (p of vm.pageData.items; track p.id) {
                  <article class="product-list-row" (click)="goToProducto(p.id, $event)">
                    <div class="list-thumb">
                      @if (p.imagen) {
                        <img [src]="p.imagen" [alt]="''" class="list-thumb-img" />
                      } @else {
                        <div class="list-thumb-placeholder" aria-hidden="true">◇</div>
                      }
                    </div>
                    <div class="list-main">
                      <h2 class="list-title" [class.stock-bajo]="esStockBajo(p)">{{ p.nombre }}</h2>
                      <p class="list-meta">
                        <span class="card-code">{{ p.codigo }}</span>
                        @if (p.categorias.length) {
                          <span class="list-cat"> · {{ formatProductoCategorias(p) }}</span>
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
                          @if (canEmployeeCatalog()) {
                            <button type="button" role="menuitem" class="card-dd-item" (click)="cloneProductFromMenu(p)">
                              Clonar
                            </button>
                            <button type="button" role="menuitem" class="card-dd-item" (click)="openMoveProductDialog(p)">
                              Mover a carpeta…
                            </button>
                          }
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
          }
          @case ('table') {
            <section class="stats-bar" aria-label="Resumen">
              <div class="stat">
                <span class="stat-icon stat-icon--blue" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Productos</span>
                  <span class="stat-value">{{ vm.pageData.itemCount }}</span>
                </div>
              </div>
              <div class="stat">
                <span class="stat-icon stat-icon--amber" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 7h-7L9 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Cantidad total</span>
                  <span class="stat-value">{{ vm.pageData.totalQty }} uds.</span>
                </div>
              </div>
              <div class="stat">
                <span class="stat-icon stat-icon--green" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </span>
                <div class="stat-body">
                  <span class="stat-label">Valor total</span>
                  <span class="stat-value">{{ vm.pageData.totalValue | currency: companyCurrency() }}</span>
                </div>
              </div>
            </section>
            @if (vm.subcarpetas.length > 0 || vm.pageData.items.length > 0) {
              <div class="table-scroll">
                <table class="product-table">
                  <thead>
                    <tr>
                      <th class="col-thumb" scope="col"></th>
                      <th scope="col">Nombre</th>
                      <th scope="col">Código</th>
                      <th scope="col">Categoría</th>
                      <th scope="col" class="col-num">Uds.</th>
                      <th scope="col" class="col-num">Precio / valor</th>
                      <th scope="col" class="col-actions">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of vm.subcarpetas; track d.id) {
                      <tr class="product-table-row folder-table-row" (click)="enterFolder(d, $event)">
                        <td class="td-thumb">
                          <div class="table-thumb-ph table-thumb-ph--folder" aria-hidden="true">
                              <svg class="folder-placeholder-icon folder-placeholder-icon--sm" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                  fill="currentColor"
                                  d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
                                />
                              </svg>
                          </div>
                        </td>
                        <td class="td-name">{{ d.nombre }}</td>
                        <td class="td-code">—</td>
                        <td><span class="folder-meta-label">Carpeta</span></td>
                        <td class="col-num">{{ d.totalQty }}</td>
                        <td class="col-num td-price">{{ d.totalValue | currency: companyCurrency() }}</td>
                        <td class="td-actions" data-stop-nav (click)="$event.stopPropagation()">
                          @if (canManageFolders()) {
                            <div class="folder-item-menu-root table-kebab">
                              <button
                                type="button"
                                class="card-kebab"
                                [class.open]="folderMenuId() === d.id"
                                [attr.aria-expanded]="folderMenuId() === d.id"
                                aria-haspopup="menu"
                                aria-label="Más acciones en carpeta"
                                (click)="toggleFolderMenu(d.id, $event)"
                              >
                                <svg class="card-kebab-icon" viewBox="0 0 24 24" aria-hidden="true">
                                  <circle cx="12" cy="5" r="2" fill="currentColor" />
                                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                                  <circle cx="12" cy="19" r="2" fill="currentColor" />
                                </svg>
                              </button>
                              @if (folderMenuId() === d.id) {
                                <div class="card-dropdown card-dropdown--left" role="menu">
                                  <button type="button" role="menuitem" class="card-dd-item" (click)="renameFolderPrompt(d)">
                                    Renombrar
                                  </button>
                                  <button type="button" role="menuitem" class="card-dd-item" (click)="openMoveFolderDialog(d)">
                                    Mover…
                                  </button>
                                  <button type="button" role="menuitem" class="card-dd-item" (click)="cloneFolderConfirm(d)">
                                    Clonar carpeta
                                  </button>
                                  @if (canDeleteProduct()) {
                                    <button type="button" role="menuitem" class="card-dd-item danger" (click)="deleteFolderConfirm(d)">
                                      Eliminar carpeta
                                    </button>
                                  }
                                </div>
                              }
                            </div>
                          } @else {
                            —
                          }
                        </td>
                      </tr>
                    }
                    @for (p of vm.pageData.items; track p.id) {
                      <tr
                        [class.row-stock-bajo]="esStockBajo(p)"
                        class="product-table-row"
                        (click)="goToProducto(p.id, $event)"
                      >
                        <td class="td-thumb">
                          @if (p.imagen) {
                            <img [src]="p.imagen" [alt]="''" class="table-thumb-img" />
                          } @else {
                            <div class="table-thumb-ph" aria-hidden="true">◇</div>
                          }
                        </td>
                        <td class="td-name" [class.stock-bajo]="esStockBajo(p)">{{ p.nombre }}</td>
                        <td class="td-code">{{ p.codigo }}</td>
                        <td>{{ formatProductoCategorias(p) }}</td>
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
                                @if (canEmployeeCatalog()) {
                                  <button
                                    type="button"
                                    role="menuitem"
                                    class="card-dd-item"
                                    (click)="cloneProductFromMenu(p)"
                                  >
                                    Clonar
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    class="card-dd-item"
                                    (click)="openMoveProductDialog(p)"
                                  >
                                    Mover a carpeta…
                                  </button>
                                }
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
      </div>
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
          @if (folderFormError()) {
            <p class="error">{{ folderFormError() }}</p>
          }
          <div class="modal-actions">
            <button type="button" class="btn-secondary" (click)="closeFolderDialog()">Cancelar</button>
            <button type="submit" class="btn-submit" [disabled]="folderForm.invalid || folderSaving()">Guardar</button>
          </div>
        </form>
      </div>
    </dialog>

    <dialog #moveTargetDialog class="modal modal--move-picker" (cancel)="$event.preventDefault()">
      <div class="modal-inner modal-inner--move-picker">
        <h3>{{ moveDialogTitle() }}</h3>
        <p class="move-picker-hint">Carpeta destino</p>
        <nav class="productos-tree-nav move-picker-tree" aria-label="Carpeta destino">
          <button
            type="button"
            class="tree-row tree-row--root"
            [class.tree-row--active]="movePickerSelection() === null"
            (click)="selectMovePickerTarget(null)"
          >
            <span class="tree-row-icon" aria-hidden="true">
              <svg class="tree-icon-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linejoin="round"
                  d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"
                />
              </svg>
            </span>
            <span class="tree-row-label">Todos los productos</span>
          </button>
          @for (row of flatFolderTree(); track row.id) {
            <button
              type="button"
              class="tree-row"
              [class.tree-row--active]="movePickerSelection() === row.id"
              [class.tree-row--disabled]="!movePickerAllowsFolder(row.id)"
              [disabled]="!movePickerAllowsFolder(row.id)"
              [style.padding-left.px]="10 + row.depth * 16"
              (click)="selectMovePickerTarget(row.id)"
            >
              <span class="tree-row-icon" aria-hidden="true">
                <svg class="tree-icon-svg tree-icon-svg--muted" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linejoin="round"
                    d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"
                  />
                </svg>
              </span>
              <span class="tree-row-label">{{ row.nombre }}</span>
            </button>
          }
        </nav>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" (click)="closeMoveDialog()">Cancelar</button>
          <button type="button" class="btn-submit" (click)="confirmMoveFromPicker()">Mover</button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    :host {
      --inv-cta: var(--story-primary);
      --inv-cta-hover: var(--story-primary-hover);
      --inv-danger: var(--story-danger);
      --inv-surface: #ffffff;
      --inv-border: #e2e8f0;
      --inv-border-strong: #cbd5e1;
      --inv-muted: #64748b;
      --inv-text: #0f172a;
      --inv-text-soft: #334155;
      --inv-page: #f8fafc;
      --inv-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
      --inv-shadow-hover: 0 10px 25px rgba(15, 23, 42, 0.08);
      --inv-focus-ring: 0 0 0 3px var(--story-focus-ring);
      display: block;
    }

    .productos-page {
      max-width: 1440px;
      margin: 0 auto;
      padding: 0 0.75rem 2rem;
    }

    .productos-layout {
      display: flex;
      align-items: flex-start;
      gap: 1.25rem;
    }

    .productos-tree {
      flex: 0 0 260px;
      max-width: 280px;
      position: sticky;
      top: 0.75rem;
      align-self: flex-start;
      max-height: calc(100vh - 1.5rem);
      overflow-y: auto;
      overflow-x: hidden;
      border: 1px solid var(--inv-border);
      border-radius: 14px;
      background: var(--inv-surface);
      box-shadow: var(--inv-shadow);
    }

    .productos-tree-title {
      padding: 0.85rem 1rem 0.65rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--inv-muted);
      border-bottom: 1px solid var(--inv-border);
    }

    .productos-tree-nav {
      padding: 0.35rem 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tree-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      width: 100%;
      text-align: left;
      border: none;
      background: transparent;
      cursor: pointer;
      font: inherit;
      font-size: 0.88rem;
      color: var(--inv-text-soft);
      padding: 0.5rem 0.7rem;
      border-radius: 8px;
      margin: 0 0.35rem;
      box-sizing: border-box;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .tree-row:hover {
      background: #f1f5f9;
    }

    .tree-row:focus-visible {
      outline: none;
      box-shadow: var(--inv-focus-ring);
    }

    .tree-row--active {
      background: rgba(30, 64, 175, 0.08);
      color: var(--inv-cta);
      font-weight: 600;
    }

    .tree-row-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
    }

    .tree-icon-svg {
      width: 18px;
      height: 18px;
      color: #4b5563;
    }

    .tree-icon-svg--muted {
      color: #9ca3af;
    }

    .tree-row--active .tree-icon-svg,
    .tree-row--active .tree-icon-svg--muted {
      color: var(--inv-cta);
    }

    .tree-row-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .productos-main {
      flex: 1;
      min-width: 0;
    }

    @media (max-width: 799px) {
      .productos-layout {
        flex-direction: column;
      }

      .productos-tree {
        position: relative;
        top: 0;
        max-height: 220px;
        flex: none;
        width: 100%;
        max-width: none;
      }
    }

    .page-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin: 0.25rem 0 1.25rem;
    }

    .page-head-text {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .page-title {
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.1rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
      color: var(--inv-text);
    }

    .page-sub {
      margin: 0;
      font-size: 0.92rem;
      color: var(--inv-muted);
    }

    .page-head-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
    }

    .btn-secondary-header {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      height: 2.5rem;
      padding: 0 0.95rem;
      border-radius: 10px;
      border: 1px solid var(--inv-border-strong);
      background: var(--inv-surface);
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      color: var(--inv-text-soft);
      transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }

    .btn-secondary-header svg {
      color: var(--inv-muted);
      transition: color 0.18s ease;
    }

    .btn-secondary-header:hover {
      border-color: var(--inv-cta);
      color: var(--inv-cta);
      background: #ffffff;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }

    .btn-secondary-header:hover svg {
      color: var(--inv-cta);
    }

    .btn-secondary-header:focus-visible {
      outline: none;
      box-shadow: var(--inv-focus-ring);
    }

    .folder-bc {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
      margin: 0 0 1.1rem;
      padding: 0.55rem 0.85rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 10px;
      font-size: 0.85rem;
      box-shadow: var(--inv-shadow);
    }

    .folder-bc-home {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--inv-muted);
      margin-right: 0.1rem;
    }

    .folder-bc-link {
      border: none;
      background: none;
      padding: 0.2rem 0.45rem;
      cursor: pointer;
      color: var(--inv-text-soft);
      font: inherit;
      font-size: 0.85rem;
      font-weight: 500;
      text-decoration: none;
      border-radius: 6px;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .folder-bc-link:hover {
      color: var(--inv-cta);
      background: rgba(30, 64, 175, 0.06);
    }

    .folder-bc-link--current {
      color: var(--inv-text);
      font-weight: 700;
      cursor: default;
    }

    .folder-bc-sep {
      display: inline-flex;
      align-items: center;
      color: #cbd5e1;
      user-select: none;
    }

    .folder-block {
      margin-bottom: 1rem;
    }

    .folder-block.card-grid {
      gap: 1.25rem;
    }

    .folder-card .card-placeholder--folder {
      background: linear-gradient(145deg, #e0e7ff, #eef2ff);
    }

    .folder-placeholder-icon {
      width: 2.75rem;
      height: 2.75rem;
      color: #a5b4fc;
      opacity: 0.95;
    }

    .folder-placeholder-icon--sm {
      width: 1.35rem;
      height: 1.35rem;
    }

    .list-thumb-placeholder--folder {
      background: linear-gradient(145deg, #e0e7ff, #eef2ff);
    }

    .folder-meta-label {
      font-family: inherit;
      color: #6366f1;
      font-weight: 600;
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    tr.folder-table-row {
      background: #f8fafc;
    }

    tr.folder-table-row .td-name {
      font-weight: 700;
    }

    .modal--move-picker {
      max-width: 22rem;
      width: calc(100vw - 2rem);
    }

    .modal-inner--move-picker .move-picker-hint {
      margin: 0 0 0.65rem;
      font-size: 0.82rem;
      color: var(--inv-muted);
      font-weight: 500;
    }

    .move-picker-tree {
      max-height: min(55vh, 280px);
      overflow-y: auto;
      margin: 0 0 0.25rem;
      padding: 0.35rem 0;
      border: 1px solid var(--inv-border);
      border-radius: 10px;
      background: #fafafa;
      box-sizing: border-box;
    }

    .move-picker-tree .tree-row--disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }

    .move-picker-tree .tree-row--disabled:hover {
      background: transparent;
    }

    .folder-item-menu-root {
      position: relative;
      flex-shrink: 0;
    }

    .btn-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      height: 2.35rem;
      padding: 0 0.95rem;
      border: 1px solid var(--inv-cta);
      border-radius: 10px;
      background: var(--inv-cta);
      color: #ffffff;
      font-size: 0.86rem;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
      cursor: pointer;
      transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.05s ease;
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.25);
    }

    .btn-cta:active {
      transform: translateY(1px);
    }

    .btn-cta:hover {
      background: var(--inv-cta-hover);
      border-color: var(--inv-cta-hover);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.3);
    }

    .btn-cta:focus-visible {
      outline: none;
      box-shadow: var(--inv-focus-ring), 0 4px 12px rgba(30, 64, 175, 0.25);
    }

    .toolbar-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      padding: 0.75rem 0.85rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 14px;
      box-shadow: var(--inv-shadow);
    }

    .search-wrap {
      position: relative;
      flex: 1 1 18rem;
      min-width: 14rem;
      max-width: 26rem;
    }

    .search-icon {
      position: absolute;
      left: 0.85rem;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      color: #94a3b8;
      pointer-events: none;
      transition: color 0.18s ease;
    }

    .search-wrap:focus-within .search-icon {
      color: var(--inv-cta);
    }

    .search-input {
      width: 100%;
      height: 2.5rem;
      padding: 0 0.95rem 0 2.5rem;
      border: 1px solid var(--inv-border-strong);
      border-radius: 10px;
      background: var(--inv-surface);
      font-size: 0.92rem;
      color: var(--inv-text);
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .search-input::placeholder {
      color: #94a3b8;
    }

    .search-input:hover {
      border-color: #94a3b8;
    }

    .search-input:focus {
      border-color: var(--inv-cta);
      box-shadow: var(--inv-focus-ring);
    }

    .cat-filter {
      position: relative;
      display: inline-flex;
      align-items: center;
      min-width: 12rem;
    }

    .cat-filter-icon {
      position: absolute;
      left: 0.7rem;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      color: var(--inv-muted);
      pointer-events: none;
      transition: color 0.18s ease;
    }

    .cat-filter:focus-within .cat-filter-icon {
      color: var(--inv-cta);
    }

    .cat-filter-select {
      width: 100%;
      height: 2.5rem;
      padding: 0 2.25rem 0 2.35rem;
      border: 1px solid var(--inv-border-strong);
      border-radius: 10px;
      background: var(--inv-surface);
      font: inherit;
      font-size: 0.88rem;
      color: var(--inv-text);
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.65rem center;
      background-size: 14px;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .cat-filter-select:hover {
      border-color: #94a3b8;
    }

    .cat-filter-select:focus {
      outline: none;
      border-color: var(--inv-cta);
      box-shadow: var(--inv-focus-ring);
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      margin-left: auto;
      position: relative;
    }

    .sort-dropdown {
      position: relative;
    }

    .sort-trigger {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      height: 2.5rem;
      padding: 0 0.65rem 0 0.85rem;
      border: 1px solid var(--inv-border-strong);
      border-radius: 10px;
      background: var(--inv-surface);
      font-size: 0.88rem;
      cursor: pointer;
      color: var(--inv-text-soft);
      min-width: 12.5rem;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
    }

    .sort-trigger:hover {
      border-color: var(--inv-cta);
      color: var(--inv-text);
    }

    .sort-trigger:hover .sort-trigger-icon,
    .sort-trigger[aria-expanded='true'] .sort-trigger-icon {
      color: var(--inv-cta);
    }

    .sort-trigger:focus-visible {
      outline: none;
      box-shadow: var(--inv-focus-ring);
    }

    .sort-trigger-icon {
      color: var(--inv-muted);
      flex-shrink: 0;
      transition: color 0.18s ease;
    }

    .sort-trigger-main {
      flex: 1;
      font-weight: 500;
      text-align: left;
    }

    .sort-trigger-chev {
      color: var(--inv-muted);
      flex-shrink: 0;
      transition: transform 0.2s ease;
    }

    .sort-trigger[aria-expanded='true'] .sort-trigger-chev {
      transform: rotate(180deg);
    }

    .sort-panel {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      min-width: 14rem;
      padding: 0.4rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
      z-index: 20;
    }

    .sort-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 0.75rem;
      padding: 0.55rem 0.75rem;
      border: none;
      border-radius: 8px;
      background: transparent;
      font-size: 0.9rem;
      cursor: pointer;
      color: var(--inv-text-soft);
      text-align: left;
      transition: background 0.12s ease;
    }

    .sort-option:hover {
      background: #f1f5f9;
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

    .layout-segmented {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      height: 2.5rem;
      background: #f1f5f9;
      border: 1px solid var(--inv-border);
      border-radius: 10px;
    }

    .layout-seg-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.1rem;
      height: 100%;
      padding: 0;
      border: none;
      border-radius: 7px;
      background: transparent;
      color: var(--inv-muted);
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
    }

    .layout-seg-btn:hover {
      color: var(--inv-text);
    }

    .layout-seg-btn.active {
      background: var(--inv-surface);
      color: var(--inv-cta);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1), 0 1px 2px rgba(15, 23, 42, 0.06);
    }

    .layout-seg-btn:focus-visible {
      outline: none;
      box-shadow: var(--inv-focus-ring);
    }

    .stats-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.75rem;
      margin-bottom: 1.25rem;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 1rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 12px;
      box-shadow: var(--inv-shadow);
      transition: border-color 0.18s ease, transform 0.18s ease;
    }

    .stat:hover {
      border-color: var(--inv-border-strong);
      transform: translateY(-1px);
    }

    .stat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 10px;
      flex-shrink: 0;
    }

    .stat-icon--blue {
      background: rgba(30, 64, 175, 0.10);
      color: var(--inv-cta);
    }

    .stat-icon--amber {
      background: rgba(245, 158, 11, 0.14);
      color: #d97706;
    }

    .stat-icon--green {
      background: rgba(21, 128, 61, 0.10);
      color: var(--story-success);
    }

    .stat-body {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
      min-width: 0;
    }

    .stat-label {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--inv-muted);
    }

    .stat-value {
      font-size: 1.2rem;
      font-weight: 700;
      color: var(--inv-text);
      letter-spacing: -0.015em;
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
      border-radius: 14px;
      overflow: visible;
      border: 1px solid var(--inv-border);
      box-shadow: var(--inv-shadow);
      transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
    }

    /** Encima de la tarjeta/fila siguiente cuando el menú ⋮ está abierto (evita que tape el dropdown) */
    .product-card:has(.card-kebab.open),
    .product-list-row:has(.card-kebab.open),
    .product-table-row:has(.card-kebab.open) {
      position: relative;
      z-index: 5;
    }

    .product-card--click {
      cursor: pointer;
    }

    .product-card--click:hover {
      box-shadow: var(--inv-shadow-hover);
      transform: translateY(-2px);
      border-color: var(--inv-border-strong);
    }

    .card-image-wrap {
      position: relative;
      aspect-ratio: 4 / 3;
      background: #eceef1;
      border-radius: 14px 14px 0 0;
      overflow: hidden;
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
    .folder-card:hover .card-kebab,
    .folder-card .card-kebab.open,
    .product-list-row:hover .list-kebab .card-kebab,
    .folder-list-row:hover .list-kebab .card-kebab,
    .list-kebab .card-kebab.open,
    .product-table-row:hover .table-kebab .card-kebab,
    .folder-table-row:hover .table-kebab .card-kebab,
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
      padding: 0.35rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14), 0 0 1px rgba(15, 23, 42, 0.08);
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
      padding: 0.55rem 0.75rem;
      border: none;
      background: transparent;
      border-radius: 8px;
      font-size: 0.88rem;
      text-align: left;
      cursor: pointer;
      color: var(--inv-text-soft);
      transition: background 0.12s ease;
    }

    .card-dd-item:hover {
      background: #f1f5f9;
    }

    .card-dd-item.danger {
      color: var(--inv-danger);
    }

    .card-dd-item.danger:hover {
      background: rgba(185, 28, 28, 0.08);
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
      color: var(--inv-text);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-title.stock-bajo {
      color: var(--inv-danger);
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
      color: var(--inv-text);
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
      padding: 0.85rem 1rem;
      background: var(--inv-surface);
      border: 1px solid var(--inv-border);
      border-radius: 12px;
      box-shadow: var(--inv-shadow);
      cursor: pointer;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }

    .product-list-row:hover {
      border-color: var(--inv-border-strong);
      box-shadow: var(--inv-shadow-hover);
      transform: translateY(-1px);
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
      color: var(--inv-text);
    }

    .list-title.stock-bajo {
      color: var(--inv-danger);
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
      color: var(--inv-text);
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
      border-radius: 14px;
      overflow: visible;
      box-shadow: var(--inv-shadow);
    }

    .product-table thead {
      background: #f8fafc;
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
      background: #f8fafc;
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

    .table-thumb-ph--folder {
      background: linear-gradient(145deg, #e0e7ff, #eef2ff);
    }

    .td-name {
      font-weight: 600;
      color: var(--inv-text);
      max-width: 14rem;
    }

    .td-name.stock-bajo {
      color: var(--inv-danger);
    }

    .td-code {
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      color: var(--inv-muted);
    }

    .td-price {
      font-weight: 600;
      color: var(--inv-text);
    }

    .td-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    tr.product-table-row {
      transition: background 0.15s ease;
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
      background: rgba(185, 28, 28, 0.04);
    }

    .modal {
      border: none;
      border-radius: 16px;
      padding: 0;
      max-width: 26rem;
      width: calc(100vw - 2rem);
      box-shadow: 0 25px 50px rgba(15, 23, 42, 0.2);
    }

    .modal::backdrop {
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
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
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--inv-border-strong);
      border-radius: 10px;
      font: inherit;
      resize: vertical;
      min-height: 4rem;
      background: #ffffff;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    input[type='text']:focus,
    input[type='number']:focus,
    textarea:focus {
      outline: none;
      border-color: var(--inv-cta);
      box-shadow: var(--inv-focus-ring);
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
      padding: 0.6rem 1.05rem;
      border-radius: 10px;
      border: 1px solid var(--inv-border-strong);
      background: #ffffff;
      cursor: pointer;
      font-weight: 600;
      color: var(--inv-text-soft);
      transition: border-color 0.18s ease, background 0.18s ease;
    }

    .btn-secondary:hover {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .btn-submit {
      padding: 0.6rem 1.1rem;
      border: 1px solid var(--inv-cta);
      border-radius: 10px;
      background: var(--inv-cta);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.22);
      transition: background 0.18s ease, box-shadow 0.18s ease;
    }

    .btn-submit:hover:not(:disabled) {
      background: var(--inv-cta-hover);
      border-color: var(--inv-cta-hover);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.3);
    }

    .btn-submit:focus-visible {
      outline: none;
      box-shadow: var(--inv-focus-ring);
    }

    .btn-submit:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
    }

    .error {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--inv-danger);
      font-size: 0.85rem;
      margin: 0;
      padding: 0.55rem 0.7rem;
      background: rgba(185, 28, 28, 0.07);
      border: 1px solid rgba(185, 28, 28, 0.2);
      border-radius: 8px;
    }
  `,
})
export class ProductosComponent implements OnInit {
  protected readonly formatProductoCategorias = formatProductoCategorias;

  private readonly api = inject(CatalogoApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly reload$ = new BehaviorSubject(0);
  private readonly search$ = new BehaviorSubject('');

  protected readonly searchTerm = signal('');

  protected readonly breadcrumbs = signal<{ id: number | null; nombre: string }[]>([
    { id: null, nombre: 'Productos' },
  ]);
  protected readonly currentCarpetaId = signal<number | null>(null);
  protected readonly categoriaFiltro = signal<number | null>(null);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  private readonly carpetaId$ = toObservable(this.currentCarpetaId);
  private readonly categoriaFiltro$ = toObservable(this.categoriaFiltro);

  /** Menú ⋮ por carpeta */
  protected readonly folderMenuId = signal<number | null>(null);
  protected readonly moveDialogTitle = signal('Mover');
  /** IDs de carpeta no elegibles (p. ej. subárbol al mover una carpeta). */
  protected readonly movePickerExcludedIds = signal<Set<number>>(new Set());
  /** Destino: `null` = raíz (sin carpeta). */
  protected readonly movePickerSelection = signal<number | null>(null);
  private pendingFolderMove: CarpetaArbolDto | null = null;
  private pendingProductMove: ProductoDto | null = null;

  private readonly latestArbol = signal<CarpetaArbolDto[]>([]);

  protected readonly flatFolderTree = computed(() => flattenCarpetasForTree(this.latestArbol()));

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

  protected readonly vm$ = combineLatest([
    this.reload$,
    this.carpetaId$,
    this.categoriaFiltro$,
    this.search$,
    this.sortState$,
  ]).pipe(
    switchMap(([_, fid, catId, q, sort]) =>
      forkJoin({
        page: this.api.getProductos(fid, catId),
        allCompany: this.api.getTodosProductosEmpresa().pipe(
          catchError(() => of<ProductoDto[]>([])),
        ),
        arbol: this.api.getCarpetasArbol().pipe(
          catchError(() => of<CarpetaArbolDto[]>([])),
        ),
      }).pipe(
        tap(({ arbol }) => this.latestArbol.set(arbol)),
        map(({ page, allCompany, arbol }) => {
          const qq = q.trim().toLowerCase();
          let subcarpetas = this.buildSubcarpetasVm(
            carpetasEnNivel(arbol, fid),
            arbol,
            allCompany,
          );
          if (qq) {
            subcarpetas = subcarpetas.filter((d) => d.nombre.toLowerCase().includes(qq));
          }
          subcarpetas = this.sortSubcarpetas(subcarpetas, sort);
          return {
            pageData: this.buildPageData(page, q, sort),
            subcarpetas,
          };
        }),
      ),
    ),
  );

  private readonly sortDropdownRef = viewChild<ElementRef<HTMLElement>>('sortDropdown');
  private readonly layoutDropdownRef = viewChild<ElementRef<HTMLElement>>('layoutDropdown');
  private readonly historialDialogRef = viewChild<ElementRef<HTMLDialogElement>>('historialDialog');
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('productDialog');
  private readonly folderDialogRef = viewChild<ElementRef<HTMLDialogElement>>('folderDialog');
  private readonly moveDialogRef = viewChild<ElementRef<HTMLDialogElement>>('moveTargetDialog');

  protected readonly editingId = signal<number | null>(null);
  protected readonly dialogTitle = signal('Nuevo producto');
  protected readonly formError = signal('');
  protected readonly saving = signal(false);

  private file: File | null = null;

  protected readonly folderFormError = signal('');
  protected readonly folderSaving = signal(false);

  protected readonly folderForm = this.fb.group({
    nombre: this.fb.nonNullable.control('', Validators.required),
    descripcion: this.fb.nonNullable.control(''),
  });

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

  ngOnInit(): void {
    this.api.getCategorias().subscribe({
      next: (list) => this.categorias.set(list),
      error: () => this.categorias.set([]),
    });

    const raw = this.route.snapshot.queryParamMap.get('carpeta');
    if (!raw) {
      return;
    }
    const id = Number(raw);
    if (!Number.isFinite(id) || id <= 0) {
      return;
    }
    this.currentCarpetaId.set(id);
    this.api.getCarpetasArbol().subscribe({
      next: (tree) => {
        const path = pathToFolder(tree, id);
        if (path.length) {
          this.breadcrumbs.set([{ id: null, nombre: 'Productos' }, ...path]);
        }
      },
      error: () => {},
    });
  }

  private syncQueryParam(): void {
    const id = this.currentCarpetaId();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: id == null ? {} : { carpeta: id },
      replaceUrl: true,
    });
  }

  protected goBreadcrumb(index: number): void {
    const crumbs = this.breadcrumbs().slice(0, index + 1);
    this.breadcrumbs.set(crumbs);
    const last = crumbs[crumbs.length - 1];
    this.currentCarpetaId.set(last?.id ?? null);
    this.folderMenuId.set(null);
    this.refreshList();
    this.syncQueryParam();
  }

  /** Navegación desde el panel de árbol (equivalente a migas de pan). */
  protected treeGoTo(carpetaId: number | null): void {
    if (carpetaId === null) {
      this.breadcrumbs.set([{ id: null, nombre: 'Productos' }]);
      this.currentCarpetaId.set(null);
    } else {
      const tree = this.latestArbol();
      const path = pathToFolder(tree, carpetaId);
      if (path.length) {
        this.breadcrumbs.set([{ id: null, nombre: 'Productos' }, ...path]);
      } else {
        this.breadcrumbs.set([
          { id: null, nombre: 'Productos' },
          { id: carpetaId, nombre: 'Carpeta' },
        ]);
      }
      this.currentCarpetaId.set(carpetaId);
    }
    this.folderMenuId.set(null);
    this.itemMenuId.set(null);
    this.refreshList();
    this.syncQueryParam();
  }

  protected enterFolder(d: CarpetaArbolDto, ev?: MouseEvent): void {
    if (ev) {
      const el = ev.target as HTMLElement | null;
      if (el?.closest?.('[data-stop-nav]')) {
        return;
      }
    }
    this.breadcrumbs.update((b) => [...b, { id: d.id, nombre: d.nombre }]);
    this.currentCarpetaId.set(d.id);
    this.folderMenuId.set(null);
    this.refreshList();
    this.syncQueryParam();
  }

  protected toggleFolderMenu(id: number, ev: Event): void {
    ev.stopPropagation();
    this.folderMenuId.update((cur) => (cur === id ? null : id));
  }

  protected openCreateFolder(): void {
    if (!this.canManageFolders()) {
      return;
    }
    this.folderForm.reset({ nombre: '', descripcion: '' });
    this.folderFormError.set('');
    queueMicrotask(() => this.folderDialogRef()?.nativeElement.showModal());
  }

  protected closeFolderDialog(): void {
    this.folderDialogRef()?.nativeElement.close();
  }

  protected saveFolder(): void {
    if (this.folderForm.invalid) {
      return;
    }
    const v = this.folderForm.getRawValue();
    const nombre = v.nombre.trim();
    if (!nombre) {
      return;
    }
    const parentId = this.currentCarpetaId();
    this.folderFormError.set('');
    this.folderSaving.set(true);
    this.api
      .crearCarpeta({
        nombre,
        descripcion: typeof v.descripcion === 'string' ? v.descripcion.trim() : '',
        ...(parentId != null ? { parentId } : {}),
      })
      .subscribe({
        next: () => {
          this.folderSaving.set(false);
          this.closeFolderDialog();
          this.refreshList();
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.folderSaving.set(false);
          const msg = err?.error?.message ?? err?.message ?? 'No se pudo crear la carpeta';
          this.folderFormError.set(typeof msg === 'string' ? msg : 'No se pudo crear la carpeta');
        },
      });
  }

  protected renameFolderPrompt(d: CarpetaArbolDto): void {
    this.folderMenuId.set(null);
    if (!this.canManageFolders()) {
      return;
    }
    const nombre = globalThis.prompt('Nuevo nombre', d.nombre);
    if (nombre == null) {
      return;
    }
    const t = nombre.trim();
    if (!t) {
      return;
    }
    this.api.renombrarCarpeta(d.id, t).subscribe({
      next: () => {
        this.breadcrumbs.update((crumbs) =>
          crumbs.map((c) => (c.id === d.id ? { ...c, nombre: t } : c)),
        );
        this.refreshList();
      },
      error: () => globalThis.alert('No se pudo renombrar'),
    });
  }

  protected openMoveFolderDialog(d: CarpetaArbolDto): void {
    this.folderMenuId.set(null);
    if (!this.canManageFolders()) {
      return;
    }
    this.pendingFolderMove = d;
    this.pendingProductMove = null;
    this.moveDialogTitle.set('Mover carpeta');
    const tree = this.latestArbol();
    const ex = collectCarpetaSubtreeIds(tree, d.id);
    this.movePickerExcludedIds.set(ex);
    this.movePickerSelection.set(null);
    queueMicrotask(() => this.moveDialogRef()?.nativeElement.showModal());
  }

  protected cloneFolderConfirm(d: CarpetaArbolDto): void {
    this.folderMenuId.set(null);
    if (!this.canManageFolders()) {
      return;
    }
    if (!globalThis.confirm(`¿Clonar la carpeta "${d.nombre}" con todo su contenido?`)) {
      return;
    }
    this.api.clonarCarpeta(d.id).subscribe({
      next: () => this.refreshList(),
      error: () => globalThis.alert('No se pudo clonar la carpeta'),
    });
  }

  protected deleteFolderConfirm(d: CarpetaArbolDto): void {
    this.folderMenuId.set(null);
    if (!this.canDeleteProduct()) {
      globalThis.alert('Tu rol no permite eliminar carpetas');
      return;
    }
    if (
      !globalThis.confirm(
        'Se eliminarán todas las subcarpetas y todos los productos dentro de este árbol. ¿Continuar?',
      )
    ) {
      return;
    }
    this.api.eliminarCarpeta(d.id).subscribe({
      next: () => {
        if (this.breadcrumbs().some((c) => c.id === d.id)) {
          this.goBreadcrumb(0);
        } else {
          this.refreshList();
        }
      },
      error: () => globalThis.alert('No se pudo eliminar la carpeta'),
    });
  }

  protected cloneProductFromMenu(p: ProductoDto): void {
    this.itemMenuId.set(null);
    if (!this.canEmployeeCatalog()) {
      return;
    }
    this.api.clonarProducto(p.id).subscribe({
      next: () => this.refreshList(),
      error: () => globalThis.alert('No se pudo clonar el producto'),
    });
  }

  protected openMoveProductDialog(p: ProductoDto): void {
    this.itemMenuId.set(null);
    if (!this.canEmployeeCatalog()) {
      return;
    }
    this.pendingProductMove = p;
    this.pendingFolderMove = null;
    this.moveDialogTitle.set('Mover producto');
    this.movePickerExcludedIds.set(new Set());
    this.movePickerSelection.set(null);
    queueMicrotask(() => this.moveDialogRef()?.nativeElement.showModal());
  }

  protected closeMoveDialog(): void {
    this.moveDialogRef()?.nativeElement.close();
    this.pendingFolderMove = null;
    this.pendingProductMove = null;
    this.movePickerExcludedIds.set(new Set());
    this.movePickerSelection.set(null);
  }

  protected movePickerAllowsFolder(id: number): boolean {
    return !this.movePickerExcludedIds().has(id);
  }

  protected selectMovePickerTarget(carpetaId: number | null): void {
    if (carpetaId !== null && this.movePickerExcludedIds().has(carpetaId)) {
      return;
    }
    this.movePickerSelection.set(carpetaId);
  }

  protected confirmMoveFromPicker(): void {
    const carpetaDest = this.movePickerSelection();
    this.executeMoveToCarpeta(carpetaDest);
  }

  private executeMoveToCarpeta(carpetaDest: number | null): void {
    const pf = this.pendingFolderMove;
    const pp = this.pendingProductMove;
    if (pf) {
      this.api.moverCarpeta(pf.id, carpetaDest).subscribe({
        next: () => {
          this.closeMoveDialog();
          this.refreshList();
        },
        error: () => globalThis.alert('No se pudo mover la carpeta'),
      });
      return;
    }
    if (pp) {
      this.api.moverProductoCarpeta(pp.id, carpetaDest).subscribe({
        next: () => {
          this.closeMoveDialog();
          if (carpetaDest === null) {
            this.treeGoTo(null);
          } else {
            this.refreshList();
          }
        },
        error: () => globalThis.alert('No se pudo mover el producto'),
      });
    }
  }

  /** Empleado o administrador de empresa (no solo lectura). */
  protected canEmployeeCatalog(): boolean {
    const r = this.auth.currentUser()?.companyRole;
    return r === 'company_admin' || r === 'employee';
  }

  protected canManageFolders(): boolean {
    return this.canEmployeeCatalog();
  }

  protected esStockBajo(p: ProductoDto): boolean {
    if (p.stockMinimo == null) {
      return false;
    }
    return p.cantidad <= p.stockMinimo;
  }

  protected onSearch(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.searchTerm.set(v);
    this.search$.next(v);
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
      case 'AJUSTE':
        return `→ ${m.cantidad}`;
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
    if (this.folderMenuId() !== null) {
      if (!el?.closest?.('.folder-item-menu-root')) {
        this.folderMenuId.set(null);
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
          productoCoincideCategoria(p, qq),
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

  private buildSubcarpetasVm(
    dirs: CarpetaArbolDto[],
    arbol: CarpetaArbolDto[],
    allProducts: ProductoDto[],
  ): CarpetaSubcarpetaVm[] {
    return dirs.map((d) => {
      const ids = collectCarpetaSubtreeIds(arbol, d.id);
      let totalQty = 0;
      let totalValue = 0;
      for (const p of allProducts) {
        const cid = p.carpetaId;
        if (cid != null && ids.has(cid)) {
          const c = p.cantidad ?? 0;
          totalQty += c;
          totalValue += (p.precio != null ? Number(p.precio) : 0) * c;
        }
      }
      return { ...d, totalQty, totalValue };
    });
  }

  private sortSubcarpetas(rows: CarpetaSubcarpetaVm[], sort: SortState): CarpetaSubcarpetaVm[] {
    const copy = [...rows];
    switch (sort.field) {
      case 'name':
        copy.sort((a, b) => {
          const c = a.nombre.localeCompare(b.nombre, 'es');
          return sort.dir === 'asc' ? c : -c;
        });
        break;
      case 'quantity':
        copy.sort((a, b) =>
          sort.dir === 'desc' ? b.totalQty - a.totalQty : a.totalQty - b.totalQty,
        );
        break;
      case 'price':
        copy.sort((a, b) =>
          sort.dir === 'desc' ? b.totalValue - a.totalValue : a.totalValue - b.totalValue,
        );
        break;
      case 'updated':
        copy.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
        break;
    }
    return copy;
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
    const editing = this.editingId();
    const payload: ProductoFormPayload = {
      nombre: v.nombre.trim(),
      cantidad: v.cantidad,
      precio: v.precio,
      stockMinimo: this.normalizeStockMinimo(v.stockMinimo),
      descripcion: typeof v.descripcion === 'string' ? v.descripcion.trim() : '',
      imagen: this.file,
    };
    if (editing == null && this.currentCarpetaId() != null) {
      payload.carpetaId = this.currentCarpetaId();
    }
    this.formError.set('');
    this.saving.set(true);
    const req$ =
      editing == null ? this.api.createProducto(payload) : this.api.updateProducto(editing, payload);
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
