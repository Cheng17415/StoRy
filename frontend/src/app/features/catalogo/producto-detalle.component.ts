import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MovimientoStockDto, ProductoDto, CategoriaDto } from '../../core/models/catalogo.models';
import { AuthService } from '../../core/services/auth.service';
import { CatalogoApiService } from '../../core/services/catalogo-api.service';
import { RegistrarMovimientoComponent } from './registrar-movimiento.component';

@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, CurrencyPipe, RegistrarMovimientoComponent],
  template: `
    <div class="pd-page">
      <nav class="pd-breadcrumb" aria-label="Migas de pan">
        <a routerLink="/productos" class="pd-back">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m15 18-6-6 6-6" />
          </svg>
          Volver al catálogo
        </a>
      </nav>

      @if (loadError()) {
        <p class="pd-error" role="alert">{{ loadError() }}</p>
      } @else if (loading()) {
        <div class="pd-loading" aria-busy="true">
          <span class="pd-loading-bar"></span>
          <p class="pd-loading-text">Cargando ficha del producto…</p>
        </div>
      } @else if (producto(); as p) {
        <form [formGroup]="form" class="pd-form-root" (ngSubmit)="$event.preventDefault()">
        <header class="pd-hero">
          <div class="pd-hero-main">
            <div class="pd-hero-text">
              <label class="pd-title-field">
                <span class="sr-only">Nombre del producto</span>
                <input
                  type="text"
                  formControlName="nombre"
                  class="pd-title-input"
                  [class.pd-title-readonly]="!editMode()"
                  [class.pd-title-alert]="!editMode() && esStockBajo(p)"
                  [readonly]="!editMode() || !canEditFullProduct()"
                  [attr.aria-readonly]="!editMode() || !canEditFullProduct()"
                />
              </label>
              <div class="pd-hero-meta">
                <span class="pd-meta-code" title="Código interno">{{ p.codigo }}</span>
                @for (c of p.categorias; track c.id) {
                  <span class="pd-meta-pill">{{ c.nombre }}</span>
                }
                @if (!p.activo) {
                  <span class="pd-meta-pill pd-meta-pill--warn">Inactivo</span>
                }
                @if (!editMode() && esStockBajo(p)) {
                  <span class="pd-stock-flag">Stock bajo</span>
                }
              </div>
            </div>
          </div>
          <div class="pd-hero-actions">
            @if (canEditStock() || canDeleteProduct()) {
              <div class="pd-more-wrap" #moreRoot>
                <button
                  type="button"
                  class="pd-icon-btn"
                  [attr.aria-expanded]="moreMenuOpen()"
                  aria-haspopup="menu"
                  title="Más opciones"
                  (click)="toggleMoreMenu($event)"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <circle cx="12" cy="5" r="2" fill="currentColor" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <circle cx="12" cy="19" r="2" fill="currentColor" />
                  </svg>
                </button>
                @if (moreMenuOpen()) {
                  <div class="pd-more-panel" role="menu">
                    @if (canEditStock()) {
                      <button type="button" role="menuitem" class="pd-more-item" (click)="openMovimientoModal()">
                        Registrar movimiento
                      </button>
                    }
                    @if (canEditStock() && canDeleteProduct()) {
                      <div class="pd-more-sep" role="presentation"></div>
                    }
                    @if (canDeleteProduct()) {
                      <button type="button" role="menuitem" class="pd-more-item danger" (click)="confirmDelete()">
                        Eliminar producto
                      </button>
                    }
                  </div>
                }
              </div>
            }
            @if (canEditProduct()) {
              @if (editMode()) {
                <button type="button" class="pd-btn-secondary" (click)="toggleEdit()" [disabled]="saving()">
                  Cancelar
                </button>
                <button type="button" class="pd-btn-save" [disabled]="form.invalid || saving()" (click)="save()">
                  @if (saving()) {
                    <span class="pd-spinner" aria-hidden="true"></span>
                    Guardando…
                  } @else {
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z M17 21v-8H7v8 M7 3v5h8" />
                    </svg>
                    Guardar cambios
                  }
                </button>
              } @else {
                <button type="button" class="pd-btn-edit" (click)="toggleEdit()">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  Editar
                </button>
              }
            }
          </div>
        </header>

        @if (editMode() && formError()) {
          <div class="pd-hero-error" role="alert">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
            <span>{{ formError() }}</span>
          </div>
        }

        <section class="pd-metrics" aria-label="Resumen de inventario">
          <div class="pd-metric">
            <div class="pd-metric-top">
              <span class="pd-metric-label">Cantidad</span>
            </div>
            <input
              type="number"
              class="pd-metric-input"
              formControlName="cantidad"
              min="0"
              step="1"
              [readonly]="!editMode() || !canEditStock()"
              [class.pd-metric-readonly]="!editMode() || !canEditStock()"
            />
          </div>
          <div class="pd-metric">
            <div class="pd-metric-top">
              <span class="pd-metric-label">Mín. stock</span>
            </div>
            <input
              type="number"
              class="pd-metric-input"
              formControlName="stockMinimo"
              min="0"
              step="1"
              placeholder="—"
              [readonly]="!editMode() || !canEditFullProduct()"
              [class.pd-metric-readonly]="!editMode() || !canEditFullProduct()"
            />
          </div>
          <div class="pd-metric">
            <div class="pd-metric-top">
              <span class="pd-metric-label">Precio</span>
            </div>
            <div class="pd-metric-euro">
              <input
                type="number"
                class="pd-metric-input"
                formControlName="precio"
                min="0"
                step="0.01"
                [readonly]="!editMode() || !canEditFullProduct()"
                [class.pd-metric-readonly]="!editMode() || !canEditFullProduct()"
              />
            </div>
          </div>
          <div class="pd-metric pd-metric--accent">
            <div class="pd-metric-top">
              <span class="pd-metric-label">Valor total</span>
            </div>
            <p class="pd-metric-value">{{ totalDisplay() | currency: companyCurrency() }}</p>
          </div>
        </section>

        <div class="pd-grid">
          <!-- Columna izquierda -->
          <div class="pd-col pd-col--main">
            <section class="pd-card">
              <h2 class="pd-card-title">Información del producto</h2>
              <div class="pd-gallery">
                <div class="pd-gallery-main">
                  @if (previewUrl() || p.imagen) {
                    <img [src]="previewUrl() || p.imagen!" [alt]="p.nombre" class="pd-gallery-img" />
                  } @else {
                    <div class="pd-gallery-ph" aria-hidden="true">Sin imagen</div>
                  }
                </div>
                @if (editMode() && canEditFullProduct()) {
                  <div class="pd-photo-field">
                    <span class="pd-photo-field-label">Cambiar imagen</span>
                    <div class="pd-photo-upload">
                      <div class="pd-photo-upload-inner">
                        <svg
                          class="pd-photo-upload-icon"
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
                        <span class="pd-photo-upload-hint">(1 imagen, máx. 5 MB)</span>
                      </div>
                      <input
                        type="file"
                        class="pd-photo-upload-input"
                        aria-label="Subir o cambiar imagen del producto"
                        accept="image/jpeg,image/jpg,image/jfif,image/png,image/gif,image/webp"
                        (change)="onFile($event)"
                      />
                    </div>
                  </div>
                }
              </div>
              <div class="pd-block">
                <h3 class="pd-block-title">Categorías</h3>
                @if (p.categorias.length === 0 && !canEditProduct()) {
                  <p class="pd-block-empty">Sin categorías</p>
                } @else {
                  <div class="pd-cat-tags">
                    @for (c of p.categorias; track c.id) {
                      <span class="pd-tag pd-tag--chip">
                        <span class="pd-tag-label">{{ c.nombre }}</span>
                        @if (canEditProduct()) {
                          <button
                            type="button"
                            class="pd-tag-remove"
                            [disabled]="categoriaSaving()"
                            [attr.aria-label]="'Quitar categoría ' + c.nombre"
                            (click)="quitarCategoria(c.id)"
                          >
                            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
                              <path
                                fill="currentColor"
                                d="M14.348 14.849c-0.469 0.469-1.229 0.469-1.697 0l-2.651-3.030-2.651 3.029c-0.469 0.469-1.229 0.469-1.697 0-0.469-0.469-0.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-0.469-0.469-0.469-1.228 0-1.697s1.228-0.469 1.697 0l2.652 3.031 2.651-3.031c0.469-0.469 1.228-0.469 1.697 0s0.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c0.469 0.469 0.469 1.229 0 1.698z"
                              />
                            </svg>
                          </button>
                        }
                      </span>
                    }
                  </div>
                }
                @if (canEditProduct()) {
                  <div class="pd-cat-combobox" #catCombobox>
                    <div class="pd-cat-control" (click)="focusCatInput()">
                      <input
                        #catInputRef
                        type="text"
                        class="pd-cat-combo-input"
                        placeholder="Buscar o crear categoría…"
                        [disabled]="categoriaSaving()"
                        [value]="catInput()"
                        (input)="onCatInput($event)"
                        (focus)="catMenuOpen.set(true)"
                        (keydown)="onCatKeydown($event)"
                      />
                    </div>
                    @if (catMenuOpen() && catSuggestions().length > 0) {
                      <ul class="pd-cat-menu" role="listbox">
                        @for (opt of catSuggestions(); track catSuggestionTrack(opt)) {
                          <li>
                            <button
                              type="button"
                              class="pd-cat-menu-item"
                              [class.pd-cat-menu-item--create]="opt.kind === 'create'"
                              role="option"
                              (mousedown)="selectCatSuggestion(opt); $event.preventDefault()"
                            >
                              @if (opt.kind === 'create') {
                                Crear "{{ opt.nombre }}"
                              } @else {
                                {{ opt.categoria!.nombre }}
                              }
                            </button>
                          </li>
                        }
                      </ul>
                    }
                    @if (categoriaError()) {
                      <p class="pd-cat-error" role="alert">{{ categoriaError() }}</p>
                    }
                  </div>
                }
              </div>
              <div class="pd-block">
                <h3 class="pd-block-title">Notas</h3>
                <label class="pd-notes-edit">
                  <span class="sr-only">Notas sobre el producto</span>
                  <textarea
                    formControlName="descripcion"
                    class="pd-notes-textarea"
                    [class.pd-notes-textarea--view]="!editMode()"
                    rows="5"
                    [readonly]="!editMode() || !canEditFullProduct()"
                    [attr.placeholder]="notasPlaceholder()"
                  ></textarea>
                </label>
              </div>
            </section>

            <section class="pd-card pd-card--barcode">
              <h2 class="pd-card-title">Código e identificación</h2>
              <p class="pd-barcode-label">Código interno</p>
              <p class="pd-barcode-num">{{ p.codigo }}</p>
            </section>
          </div>

          <!-- Columna derecha -->
          <div class="pd-col pd-col--side">
            <section class="pd-card" id="pd-historial">
              <h2 class="pd-card-title">Historial de stock</h2>
              @if (movLoading()) {
                <p class="pd-muted">Cargando…</p>
              } @else if (movimientos().length === 0) {
                <p class="pd-muted">No hay movimientos registrados.</p>
              } @else {
                <div class="pd-table-wrap">
                  <table class="pd-table">
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
                      @for (m of movimientos(); track m.id) {
                        <tr>
                          <td>{{ m.fecha | date: 'short' }}</td>
                          <td>
                            <span
                              class="pd-mov-tipo"
                              [class.pd-mov-tipo--in]="m.tipo === 'ENTRADA'"
                              [class.pd-mov-tipo--out]="m.tipo === 'SALIDA'"
                              [class.pd-mov-tipo--adj]="m.tipo === 'AJUSTE'"
                            >
                              {{ tipoMovimientoLabel(m.tipo) }}
                            </span>
                          </td>
                          <td
                            class="num pd-mov-qty"
                            [class.pd-mov-qty--in]="m.tipo === 'ENTRADA'"
                            [class.pd-mov-qty--out]="m.tipo === 'SALIDA'"
                            [class.pd-mov-qty--adj]="m.tipo === 'AJUSTE'"
                          >
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
            </section>
          </div>
        </div>
        </form>

        @if (canEditStock()) {
          <dialog #movDialog class="pd-mov-dialog">
            <div class="pd-mov-dialog-inner">
              <h2 id="pd-mov-dialog-title" class="pd-mov-dialog-title">Registrar movimiento</h2>
              <p class="pd-mov-dialog-sub">{{ p.nombre }} · stock actual {{ p.cantidad }} uds.</p>
              <p class="pd-mov-dialog-hint">La entrada o salida quedará registrada en el historial.</p>
              <app-registrar-movimiento [producto]="p" (completado)="onMovimientoModalOk()" />
              <button type="button" class="pd-mov-dialog-close" (click)="closeMovimientoModal()">
                Cerrar
              </button>
            </div>
          </dialog>
        }
      }
    </div>
  `,
  styles: `
    :host {
      --pd-bg: var(--story-bg-page, #f8fafc);
      --pd-card: var(--story-surface, #ffffff);
      --pd-surface: var(--pd-card);
      --pd-border: var(--story-border, #e2e8f0);
      --pd-muted: var(--story-text-muted, #64748b);
      --pd-text: var(--story-text, #1e293b);
      --pd-primary: var(--story-primary, #1e40af);
      --pd-primary-soft: rgba(30, 64, 175, 0.08);
      --pd-accent-soft: rgba(245, 158, 11, 0.15);
      --pd-danger: var(--story-danger, #b91c1c);
      --pd-danger-soft: rgba(185, 28, 28, 0.08);
      display: block;
      background: var(--pd-bg);
      min-height: 100vh;
    }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }

    .pd-form-root {
      display: block;
    }

    .pd-page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 1.25rem 1.35rem 3.5rem;
    }

    .pd-breadcrumb {
      display: flex;
      align-items: center;
      margin-bottom: 1.1rem;
      font-size: 0.8125rem;
    }

    .pd-back {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-weight: 600;
      font-size: 0.85rem;
      color: var(--pd-muted);
      text-decoration: none;
      padding: 0.4rem 0.7rem;
      margin-left: -0.7rem;
      border-radius: 8px;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .pd-back:hover {
      background: var(--pd-primary-soft);
      color: var(--pd-primary);
    }

    .pd-back:focus-visible {
      outline: 2px solid var(--story-focus-ring, rgba(59, 130, 246, 0.45));
      outline-offset: 2px;
    }

    .pd-loading {
      padding: 2.5rem 1.5rem;
      text-align: center;
      background: var(--pd-card);
      border: 1px solid var(--pd-border);
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    }

    .pd-loading-bar {
      display: block;
      width: min(280px, 100%);
      height: 3px;
      margin: 0 auto 1rem;
      border-radius: 999px;
      background: linear-gradient(
        90deg,
        var(--pd-primary-soft),
        var(--pd-primary),
        var(--pd-primary-soft)
      );
      background-size: 200% 100%;
      animation: pd-shimmer 1.2s ease-in-out infinite;
    }

    @keyframes pd-shimmer {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: -100% 0;
      }
    }

    .pd-loading-text {
      margin: 0;
      font-size: 0.9rem;
      color: var(--pd-muted);
    }

    .pd-error {
      margin: 0;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      background: var(--pd-danger-soft);
      color: var(--pd-danger);
      font-size: 0.9rem;
      font-weight: 500;
    }

    .pd-muted {
      color: var(--pd-muted);
    }

    .pd-hero {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1.25rem;
      margin-bottom: 1.25rem;
      padding: 1.5rem 1.65rem;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid var(--pd-border);
      border-radius: 18px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 24px rgba(15, 23, 42, 0.04);
      position: relative;
      overflow: visible;
    }

    .pd-hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, var(--pd-primary) 0%, var(--story-secondary, #3b82f6) 60%, var(--story-accent, #f59e0b) 100%);
    }

    .pd-hero-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: -0.4rem 0 1.25rem;
      padding: 0.7rem 0.9rem;
      background: var(--pd-danger-soft);
      border: 1px solid rgba(185, 28, 28, 0.22);
      border-radius: 12px;
      color: var(--pd-danger);
      font-size: 0.88rem;
      font-weight: 500;
    }

    .pd-hero-error svg {
      flex-shrink: 0;
    }

    .pd-hero-main {
      flex: 1;
      min-width: min(100%, 16rem);
    }

    .pd-hero-text {
      min-width: 0;
    }

    .pd-title {
      margin: 0;
      font-size: clamp(1.5rem, 3vw, 1.85rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--pd-text);
      line-height: 1.2;
    }

    .pd-title.stock-bajo {
      color: var(--pd-danger);
    }

    .pd-title-field {
      display: block;
      width: 100%;
    }

    .pd-title-input {
      width: 100%;
      max-width: 100%;
      font-size: clamp(1.35rem, 2.8vw, 1.7rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      padding: 0.25rem 0;
      border: 1px solid transparent;
      border-radius: 10px;
      color: var(--pd-text);
      background: transparent;
      line-height: 1.25;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        background 0.15s ease;
    }

    .pd-title-input:not(.pd-title-readonly) {
      padding: 0.45rem 0.65rem;
      border-color: var(--story-border-strong, #cbd5e1);
      background: var(--pd-card);
    }

    .pd-title-input:not(.pd-title-readonly):focus {
      outline: none;
      border-color: var(--story-secondary, #3b82f6);
      box-shadow: 0 0 0 3px var(--story-focus-ring, rgba(59, 130, 246, 0.35));
    }

    .pd-title-readonly {
      border: none;
      background: transparent;
      cursor: default;
    }

    .pd-title-readonly:focus {
      outline: none;
    }

    .pd-title-alert {
      color: var(--story-accent-muted, #d97706);
    }

    .pd-hero-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-top: 0.65rem;
    }

    .pd-meta-code {
      font-family: ui-monospace, 'Cascadia Code', monospace;
      font-size: 0.78rem;
      font-weight: 500;
      letter-spacing: 0.06em;
      color: var(--pd-muted);
      padding: 0.2rem 0.5rem;
      background: var(--pd-bg);
      border: 1px solid var(--pd-border);
      border-radius: 6px;
    }

    .pd-meta-pill {
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      background: var(--pd-primary-soft);
      color: var(--pd-primary);
    }

    .pd-meta-pill--warn {
      background: var(--pd-danger-soft);
      color: var(--pd-danger);
    }

    .pd-stock-flag {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.25rem 0.55rem;
      border-radius: 6px;
      color: var(--story-accent-muted, #d97706);
      background: var(--pd-accent-soft);
    }

    .pd-hero-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem;
      background: #f1f5f9;
      border: 1px solid var(--pd-border);
      border-radius: 14px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
    }

    .pd-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.35rem;
      height: 2.35rem;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: var(--pd-muted);
      cursor: pointer;
      transition:
        background 0.18s ease,
        border-color 0.18s ease,
        color 0.18s ease;
    }

    .pd-icon-btn:hover:not(:disabled) {
      background: #ffffff;
      border-color: var(--pd-border);
      color: var(--pd-primary);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .pd-icon-btn:focus-visible {
      outline: 2px solid var(--story-focus-ring);
      outline-offset: 2px;
    }

    .pd-icon-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .pd-more-wrap {
      position: relative;
    }

    .pd-more-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      min-width: 12rem;
      padding: 0.4rem;
      background: var(--pd-card);
      border: 1px solid var(--pd-border);
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14), 0 0 1px rgba(15, 23, 42, 0.08);
      z-index: 80;
    }

    .pd-more-item {
      display: block;
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: none;
      border-radius: 8px;
      background: transparent;
      font-size: 0.88rem;
      text-align: left;
      cursor: pointer;
      color: var(--pd-text);
      transition: background 0.12s ease;
    }

    .pd-more-item:hover {
      background: #f1f5f9;
    }

    .pd-more-item.danger {
      color: var(--pd-danger);
    }

    .pd-more-item.danger:hover {
      background: var(--pd-danger-soft);
    }

    .pd-more-sep {
      height: 1px;
      margin: 0.25rem 0.5rem;
      background: var(--pd-border);
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
      letter-spacing: -0.02em;
      color: var(--pd-text);
    }

    .pd-mov-dialog-sub {
      margin: 0 0 0.4rem;
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--pd-primary);
    }

    .pd-mov-dialog-hint {
      margin: 0 0 1rem;
      font-size: 0.82rem;
      line-height: 1.45;
      color: var(--pd-muted);
    }

    .pd-mov-dialog-close {
      margin-top: 1rem;
      padding: 0.45rem 1rem;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      border: 1px solid var(--pd-border);
      border-radius: 8px;
      background: var(--pd-bg);
      color: var(--pd-text);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .pd-mov-dialog-close:hover {
      background: var(--pd-card);
    }

    .pd-btn-edit,
    .pd-btn-save,
    .pd-btn-secondary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      height: 2.35rem;
      padding: 0 0.95rem;
      border-radius: 10px;
      font-size: 0.86rem;
      font-weight: 600;
      cursor: pointer;
      transition:
        background 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        color 0.18s ease,
        transform 0.05s ease;
    }

    .pd-btn-edit {
      border: 1px solid transparent;
      background: #ffffff;
      color: var(--pd-primary);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .pd-btn-edit:hover {
      background: var(--pd-primary-soft);
      border-color: rgba(30, 64, 175, 0.2);
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.1);
    }

    .pd-btn-save {
      border: 1px solid var(--pd-primary);
      background: var(--pd-primary);
      color: var(--story-on-primary, #fff);
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.25);
    }

    .pd-btn-save:hover:not(:disabled) {
      background: var(--story-primary-hover, #1d4ed8);
      border-color: var(--story-primary-hover, #1d4ed8);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.3);
    }

    .pd-btn-save:active:not(:disabled),
    .pd-btn-edit:active {
      transform: translateY(1px);
    }

    .pd-btn-save:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
    }

    .pd-btn-secondary {
      border: 1px solid transparent;
      background: transparent;
      color: var(--pd-muted);
    }

    .pd-btn-secondary:hover:not(:disabled) {
      border-color: var(--pd-border);
      background: #ffffff;
      color: var(--pd-text);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .pd-btn-secondary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .pd-btn-edit:focus-visible,
    .pd-btn-save:focus-visible,
    .pd-btn-secondary:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--story-focus-ring, rgba(59, 130, 246, 0.45));
    }

    .pd-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: pd-spin 0.8s linear infinite;
    }

    @keyframes pd-spin {
      to { transform: rotate(360deg); }
    }

    .pd-metrics {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.85rem;
      margin-bottom: 1.5rem;
    }

    @media (min-width: 900px) {
      .pd-metrics {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    .pd-metric {
      background: var(--pd-card);
      border: 1px solid var(--pd-border);
      border-radius: 14px;
      padding: 1.05rem 1.15rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
      transition:
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        transform 0.18s ease;
    }

    .pd-metric:hover {
      border-color: var(--story-border-strong, #cbd5e1);
      transform: translateY(-1px);
    }

    .pd-metric--accent {
      background: linear-gradient(135deg, var(--pd-card) 0%, var(--pd-primary-soft) 120%);
      border-color: rgba(30, 64, 175, 0.18);
    }

    .pd-metric--accent .pd-metric-value {
      color: var(--pd-primary);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .pd-metric-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.35rem;
      margin-bottom: 0.45rem;
    }

    .pd-metric-label {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--pd-muted);
    }

    .pd-metric-value {
      margin: 0;
      font-size: 1.45rem;
      font-weight: 700;
      color: var(--pd-text);
      line-height: 1.2;
    }

    .pd-metric-input {
      width: 100%;
      max-width: 100%;
      font-size: 1.28rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      padding: 0.15rem 0.4rem;
      border: 1px solid var(--story-border-strong, #cbd5e1);
      border-radius: 8px;
      color: var(--pd-text);
      background: var(--pd-bg);
    }

    .pd-metric-input:focus {
      outline: none;
      border-color: var(--story-secondary, #3b82f6);
      box-shadow: 0 0 0 2px var(--story-focus-ring);
    }

    .pd-metric-readonly {
      border: none;
      background: transparent;
      padding-left: 0;
      cursor: default;
      -moz-appearance: textfield;
    }

    .pd-metric-readonly:focus {
      outline: none;
    }

    input.pd-metric-readonly::-webkit-outer-spin-button,
    input.pd-metric-readonly::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    .pd-metric-euro .pd-metric-input {
      padding-left: 0.35rem;
    }

    .pd-grid {
      display: grid;
      gap: 1.25rem;
    }

    @media (min-width: 960px) {
      .pd-grid {
        grid-template-columns: 1.1fr 0.9fr;
        align-items: start;
      }
    }

    .pd-card {
      background: var(--pd-card);
      border: 1px solid var(--pd-border);
      border-radius: 16px;
      padding: 1.35rem 1.45rem;
      margin-bottom: 1rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.03);
    }

    .pd-card-title {
      margin: 0 0 1rem;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--pd-text);
    }

    .pd-card-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .pd-card-head .pd-card-title {
      margin: 0;
    }

    .pd-card-add {
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--pd-border);
      border-radius: 6px;
      font-size: 1.1rem;
      color: var(--pd-muted);
      line-height: 1;
    }

    .pd-placeholder {
      margin: 0;
      font-size: 0.88rem;
      line-height: 1.55;
      color: var(--pd-muted);
    }

    .pd-gallery-main {
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--pd-border);
      background: linear-gradient(180deg, var(--pd-bg) 0%, #fff 100%);
      margin-bottom: 0.85rem;
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .pd-gallery-img {
      display: block;
      width: 100%;
      max-height: 340px;
      object-fit: contain;
    }

    .pd-gallery-ph {
      aspect-ratio: 4 / 3;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      color: #d1d5db;
    }

    .pd-photo-field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .pd-photo-field-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--pd-text);
    }

    .pd-photo-upload {
      position: relative;
      width: 100%;
      min-height: 5.5rem;
      border: 2px dashed var(--pd-border);
      border-radius: 8px;
      background: #fafafa;
      transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    }

    .pd-photo-upload:hover {
      border-color: #d1d5db;
      background: #f9fafb;
    }

    .pd-photo-upload:focus-within {
      border-color: var(--story-secondary, #3b82f6);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
      outline: none;
    }

    .pd-photo-upload-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.95rem 0.75rem;
      pointer-events: none;
      color: var(--pd-muted);
    }

    .pd-photo-upload-icon {
      flex-shrink: 0;
      opacity: 0.9;
    }

    .pd-photo-upload-hint {
      font-size: 0.72rem;
      font-weight: 500;
      text-align: center;
      line-height: 1.35;
      color: var(--pd-muted);
    }

    .pd-photo-upload-input {
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

    .pd-block {
      margin-top: 1.1rem;
      padding-top: 1rem;
      border-top: 1px solid #f3f4f6;
    }

    .pd-block-title {
      margin: 0 0 0.5rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--pd-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .pd-tag {
      display: inline-block;
      padding: 0.3rem 0.65rem;
      border-radius: 999px;
      font-size: 0.8125rem;
      font-weight: 600;
      background: var(--pd-primary-soft);
      color: var(--pd-primary);
    }

    .pd-block-empty {
      margin: 0;
      color: #9ca3af;
      font-size: 0.9rem;
    }

    .pd-cat-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      margin-bottom: 0.65rem;
    }

    .pd-tag--chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding-right: 0.25rem;
    }

    .pd-tag-label {
      line-height: 1.2;
    }

    .pd-tag-remove {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.25rem;
      height: 1.25rem;
      padding: 0;
      border: none;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.08);
      color: inherit;
      cursor: pointer;
      flex-shrink: 0;
    }

    .pd-tag-remove:hover:not(:disabled) {
      background: rgba(0, 0, 0, 0.14);
    }

    .pd-tag-remove:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pd-cat-combobox {
      position: relative;
      margin-top: 0.35rem;
      z-index: 2;
    }

    .pd-cat-combobox:focus-within {
      z-index: 50;
    }

    .pd-cat-control {
      display: flex;
      align-items: center;
      min-height: 2.5rem;
      padding: 0.35rem 0.65rem;
      border: 1px solid var(--pd-border);
      border-radius: 8px;
      background: var(--pd-card);
    }

    .pd-cat-combo-input {
      flex: 1;
      min-width: 0;
      border: none;
      background: transparent;
      font: inherit;
      color: var(--pd-text);
      outline: none;
    }

    .pd-cat-combo-input:disabled {
      opacity: 0.6;
    }

    .pd-cat-menu {
      position: absolute;
      z-index: 50;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      margin: 0;
      padding: 0.35rem 0;
      list-style: none;
      border: 1px solid var(--pd-border);
      border-radius: 8px;
      background: var(--pd-card);
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
      max-height: 12rem;
      overflow-y: auto;
      isolation: isolate;
    }

    .pd-cat-menu li {
      margin: 0;
      background: var(--pd-card);
    }

    .pd-cat-menu-item {
      display: block;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: none;
      background: var(--pd-card);
      text-align: left;
      font: inherit;
      color: var(--pd-text);
      cursor: pointer;
    }

    .pd-cat-menu-item:hover,
    .pd-cat-menu-item:focus-visible {
      background: var(--pd-primary-soft);
    }

    .pd-cat-menu-item--create {
      color: var(--pd-primary);
      font-weight: 600;
    }

    .pd-cat-error {
      margin: 0.35rem 0 0;
      font-size: 0.8125rem;
      color: #b42318;
    }

    .pd-notes-edit {
      display: block;
      margin: 0;
    }

    .pd-notes-textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--pd-border);
      border-radius: 8px;
      font: inherit;
      font-size: 0.9rem;
      line-height: 1.5;
      resize: vertical;
      min-height: 5.5rem;
      color: #374151;
      background: #fff;
      white-space: pre-wrap;
    }

    .pd-notes-textarea:focus {
      outline: none;
      border-color: var(--story-secondary, #3b82f6);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .pd-notes-textarea--view {
      border-color: #e5e7eb;
      background: #f9fafb;
      resize: none;
      cursor: default;
    }

    .pd-notes-textarea--view:focus {
      box-shadow: none;
      border-color: #e5e7eb;
    }

    .pd-card--barcode {
      background: linear-gradient(180deg, #ffffff 0%, var(--pd-bg) 100%);
    }

    .pd-card--barcode .pd-barcode-label {
      margin: 0 0 0.55rem;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--pd-muted);
    }

    .pd-barcode-num {
      margin: 0;
      padding: 0.85rem 1rem;
      font-family: ui-monospace, 'Cascadia Code', monospace;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-align: center;
      color: var(--pd-primary);
      background: var(--pd-primary-soft);
      border: 1px dashed rgba(30, 64, 175, 0.3);
      border-radius: 12px;
    }

    .error {
      color: var(--pd-danger);
      font-size: 0.85rem;
      margin: 0 0 0.75rem;
    }

    .pd-table-wrap {
      overflow-x: auto;
      max-height: min(48vh, 360px);
      overflow-y: auto;
      border: 1px solid var(--pd-border);
      border-radius: 12px;
      margin-top: 0.25rem;
    }

    .pd-table {
      width: 100%;
      min-width: 480px;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .pd-table th,
    .pd-table td {
      padding: 0.55rem 0.65rem;
      border-bottom: 1px solid var(--pd-border);
      text-align: left;
    }

    .pd-table tbody tr:hover {
      background: var(--pd-bg);
    }

    .pd-table th {
      position: sticky;
      top: 0;
      z-index: 1;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--pd-muted);
      background: var(--pd-card);
      box-shadow: 0 1px 0 var(--pd-border);
    }

    .pd-table .num {
      text-align: right;
    }

    .pd-mov-tipo {
      display: inline-block;
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
      background: var(--pd-bg);
    }

    .pd-mov-tipo--in {
      color: #15803d;
      background: rgba(21, 128, 61, 0.1);
    }

    .pd-mov-tipo--out {
      color: #b91c1c;
      background: rgba(185, 28, 28, 0.1);
    }

    .pd-mov-tipo--adj {
      color: #7c3aed;
      background: rgba(124, 58, 237, 0.1);
    }

    .pd-mov-qty {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }

    .pd-mov-qty--in {
      color: #15803d;
    }

    .pd-mov-qty--out {
      color: #b91c1c;
    }

    .pd-mov-qty--adj {
      color: #7c3aed;
    }

    @media (prefers-reduced-motion: reduce) {
      .pd-loading-bar {
        animation: none;
        background: var(--pd-primary-soft);
      }
    }
  `,
})
export class ProductoDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(CatalogoApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly producto = signal<ProductoDto | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal('');
  protected readonly movLoading = signal(false);

  protected companyCurrency(): string {
    return this.auth.currentUser()?.companyCurrency ?? 'EUR';
  }
  protected readonly movimientos = signal<MovimientoStockDto[]>([]);
  protected readonly editMode = signal(false);
  protected readonly moreMenuOpen = signal(false);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly categorias = signal<CategoriaDto[]>([]);
  protected readonly categoriaSaving = signal(false);
  protected readonly categoriaError = signal('');
  protected readonly catInput = signal('');
  protected readonly catMenuOpen = signal(false);

  private file: File | null = null;
  private productId: number | null = null;
  private readonly moreRootRef = viewChild<ElementRef<HTMLElement>>('moreRoot');
  private readonly movDialogRef = viewChild<ElementRef<HTMLDialogElement>>('movDialog');
  private readonly catInputRef = viewChild<ElementRef<HTMLInputElement>>('catInputRef');
  private readonly catComboboxRef = viewChild<ElementRef<HTMLElement>>('catCombobox');

  protected readonly catSuggestions = computed(() => {
    const q = this.catInput().trim().toLowerCase();
    const assigned = new Set((this.producto()?.categorias ?? []).map((c) => c.id));
    const available = this.categorias().filter((c) => !assigned.has(c.id));
    const matches = q
      ? available.filter((c) => c.nombre.toLowerCase().includes(q))
      : available;

    type CatSuggestion =
      | { kind: 'existing'; categoria: CategoriaDto }
      | { kind: 'create'; nombre: string };

    const opts: CatSuggestion[] = matches.slice(0, 8).map((c) => ({ kind: 'existing', categoria: c }));

    const raw = this.catInput().trim();
    if (raw) {
      const exact = available.some((c) => c.nombre.toLowerCase() === raw.toLowerCase());
      if (!exact) {
        opts.unshift({ kind: 'create', nombre: raw });
      }
    }
    return opts;
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

  ngOnInit(): void {
    this.loadCategorias();
    this.route.paramMap.subscribe((pm) => {
      const raw = pm.get('id');
      const id = raw != null ? Number(raw) : NaN;
      if (!Number.isFinite(id) || id < 1) {
        void this.router.navigate(['/productos']);
        return;
      }
      this.productId = id;
      this.loadProduct(id);
    });
  }

  private loadCategorias(): void {
    this.api.getCategorias().subscribe({
      next: (list) => this.categorias.set(list),
      error: () => this.categorias.set([]),
    });
  }

  protected focusCatInput(): void {
    this.catInputRef()?.nativeElement.focus();
    this.catMenuOpen.set(true);
  }

  protected catSuggestionTrack(
    opt:
      | { kind: 'existing'; categoria: CategoriaDto }
      | { kind: 'create'; nombre: string },
  ): string {
    return opt.kind === 'existing' ? `e-${opt.categoria.id}` : `c-${opt.nombre}`;
  }

  protected onCatInput(ev: Event): void {
    this.catInput.set((ev.target as HTMLInputElement).value);
    this.catMenuOpen.set(true);
    this.categoriaError.set('');
  }

  protected onCatKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.catMenuOpen.set(false);
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const first = this.catSuggestions()[0];
      if (first) {
        this.selectCatSuggestion(first);
      }
    }
  }

  protected selectCatSuggestion(
    opt:
      | { kind: 'existing'; categoria: CategoriaDto }
      | { kind: 'create'; nombre: string },
  ): void {
    if (this.productId == null) return;
    this.categoriaSaving.set(true);
    this.categoriaError.set('');
    const payload =
      opt.kind === 'existing'
        ? { categoriaId: opt.categoria.id }
        : { nombre: opt.nombre };
    this.api.agregarProductoCategoria(this.productId, payload).subscribe({
      next: (p) => {
        this.producto.set(p);
        this.catInput.set('');
        this.catMenuOpen.set(false);
        this.categoriaSaving.set(false);
        if (opt.kind === 'create') {
          this.loadCategorias();
        }
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.categoriaSaving.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'No se pudo añadir la categoría';
        this.categoriaError.set(typeof msg === 'string' ? msg : 'No se pudo añadir la categoría');
      },
    });
  }

  protected quitarCategoria(categoriaId: number): void {
    if (this.productId == null) return;
    this.categoriaSaving.set(true);
    this.categoriaError.set('');
    this.api.quitarProductoCategoria(this.productId, categoriaId).subscribe({
      next: (p) => {
        this.producto.set(p);
        this.categoriaSaving.set(false);
      },
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.categoriaSaving.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'No se pudo quitar la categoría';
        this.categoriaError.set(typeof msg === 'string' ? msg : 'No se pudo quitar la categoría');
      },
    });
  }

  private loadProduct(id: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.previewUrl.set(null);
    this.api.getProducto(id).subscribe({
      next: (p) => {
        this.producto.set(p);
        this.form.patchValue({
          nombre: p.nombre,
          cantidad: p.cantidad,
          precio: p.precio ?? 0,
          stockMinimo: p.stockMinimo ?? null,
          descripcion: p.descripcion ?? '',
        });
        this.file = null;
        this.loading.set(false);
        this.loadMovimientos(id);
      },
      error: () => {
        this.loadError.set('No se pudo cargar el producto.');
        this.loading.set(false);
      },
    });
  }

  private loadMovimientos(id: number): void {
    this.movLoading.set(true);
    this.api.getProductoMovimientos(id).subscribe({
      next: (rows) => {
        this.movimientos.set(rows);
        this.movLoading.set(false);
      },
      error: () => {
        this.movimientos.set([]);
        this.movLoading.set(false);
      },
    });
  }

  protected notasPlaceholder(): string {
    if (this.editMode()) {
      return 'Observaciones, ubicación, etc.';
    }
    const raw = this.form.get('descripcion')?.value;
    const t = typeof raw === 'string' ? raw.trim() : '';
    return t ? '' : 'Sin notas. Pulsa Editar para añadirlas.';
  }

  protected esStockBajo(p: ProductoDto): boolean {
    if (p.stockMinimo == null) return false;
    return p.cantidad <= p.stockMinimo;
  }

  protected totalDisplay(): number {
    if (this.editMode()) {
      const v = this.form.getRawValue();
      const precio = typeof v.precio === 'number' ? v.precio : 0;
      const cant = typeof v.cantidad === 'number' ? v.cantidad : 0;
      return precio * cant;
    }
    const p = this.producto();
    if (!p) return 0;
    return (Number(p.precio) || 0) * p.cantidad;
  }

  protected tipoMovimientoLabel(tipo: string): string {
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

  protected onMovimientoManualOk(): void {
    const id = this.productId;
    if (id == null) return;
    this.api.getProducto(id).subscribe({
      next: (p) => {
        this.producto.set(p);
        if (!this.editMode()) {
          this.form.patchValue({
            cantidad: p.cantidad,
          });
        }
        this.loadMovimientos(id);
      },
    });
  }

  protected openMovimientoModal(): void {
    this.moreMenuOpen.set(false);
    queueMicrotask(() => this.movDialogRef()?.nativeElement.showModal());
  }

  protected closeMovimientoModal(): void {
    this.movDialogRef()?.nativeElement.close();
  }

  protected onMovimientoModalOk(): void {
    this.closeMovimientoModal();
    this.onMovimientoManualOk();
  }

  protected toggleEdit(): void {
    if (!this.canEditProduct()) {
      return;
    }
    this.moreMenuOpen.set(false);
    this.editMode.update((v) => {
      const next = !v;
      if (!next && this.producto()) {
        const p = this.producto()!;
        this.form.patchValue({
          nombre: p.nombre,
          cantidad: p.cantidad,
          precio: p.precio ?? 0,
          stockMinimo: p.stockMinimo ?? null,
          descripcion: p.descripcion ?? '',
        });
        this.file = null;
        this.previewUrl.set(null);
      }
      return next;
    });
  }

  protected scrollToHistorial(): void {
    this.moreMenuOpen.set(false);
    globalThis.document.getElementById('pd-historial')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected toggleMoreMenu(ev: Event): void {
    ev.stopPropagation();
    this.moreMenuOpen.update((o) => !o);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    const moreRoot = this.moreRootRef()?.nativeElement;
    if (!moreRoot?.contains(ev.target as Node) && this.moreMenuOpen()) {
      this.moreMenuOpen.set(false);
    }
    const catRoot = this.catComboboxRef()?.nativeElement;
    if (!catRoot?.contains(ev.target as Node) && this.catMenuOpen()) {
      this.catMenuOpen.set(false);
    }
  }

  protected onFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.file = f;
    if (this.previewUrl()) {
      URL.revokeObjectURL(this.previewUrl()!);
    }
    this.previewUrl.set(f ? URL.createObjectURL(f) : null);
  }

  protected save(): void {
    if (!this.canEditProduct()) {
      return;
    }
    if (this.form.invalid || this.productId == null) return;
    const v = this.form.getRawValue();
    this.formError.set('');
    this.saving.set(true);
    this.api
      .updateProducto(this.productId, {
        nombre: v.nombre.trim(),
        cantidad: v.cantidad,
        precio: v.precio,
        stockMinimo: this.normalizeStockMinimo(v.stockMinimo),
        descripcion: typeof v.descripcion === 'string' ? v.descripcion.trim() : '',
        imagen: this.file,
      })
      .subscribe({
        next: (p) => {
          this.producto.set(p);
          this.form.patchValue({
            nombre: p.nombre,
            cantidad: p.cantidad,
            precio: p.precio ?? 0,
            stockMinimo: p.stockMinimo ?? null,
            descripcion: p.descripcion ?? '',
          });
          this.saving.set(false);
          this.file = null;
          if (this.previewUrl()) {
            URL.revokeObjectURL(this.previewUrl()!);
            this.previewUrl.set(null);
          }
          this.loadMovimientos(this.productId!);
          this.editMode.set(false);
        },
        error: (err: { error?: { message?: string }; message?: string }) => {
          this.saving.set(false);
          const msg = err?.error?.message ?? err?.message ?? 'Error al guardar';
          this.formError.set(typeof msg === 'string' ? msg : 'Error al guardar');
        },
      });
  }

  private normalizeStockMinimo(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(n)) return null;
    return n < 0 ? null : Math.floor(n);
  }

  protected confirmDelete(): void {
    if (!this.canDeleteProduct()) {
      globalThis.alert('Tu rol no permite eliminar productos');
      return;
    }
    this.moreMenuOpen.set(false);
    const p = this.producto();
    if (!p || !globalThis.confirm(`¿Eliminar "${p.nombre}"?`)) return;
    this.api.deleteProducto(p.id).subscribe({
      next: () => void this.router.navigate(['/productos']),
      error: () => globalThis.alert('No se pudo eliminar el producto'),
    });
  }

  protected canDeleteProduct(): boolean {
    return this.auth.currentUser()?.companyRole === 'company_admin';
  }

  protected canEditProduct(): boolean {
    const role = this.auth.currentUser()?.companyRole;
    return role === 'company_admin' || role === 'employee';
  }

  protected canEditFullProduct(): boolean {
    return this.auth.currentUser()?.companyRole === 'company_admin';
  }

  protected canEditStock(): boolean {
    const role = this.auth.currentUser()?.companyRole;
    return role === 'company_admin' || role === 'employee';
  }
}
