import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MovimientoStockDto, ProductoDto } from '../../core/models/catalogo.models';
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
          <span class="pd-back-icon" aria-hidden="true">←</span>
          Catálogo
        </a>
        <span class="pd-bc-sep" aria-hidden="true">/</span>
        <span class="pd-bc-current">Detalle</span>
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
                @if (p.categoriaNombre) {
                  <span class="pd-meta-pill">{{ p.categoriaNombre }}</span>
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
              <button type="button" class="pd-btn-edit" (click)="toggleEdit()">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                  />
                </svg>
                {{ editMode() ? 'Ver' : 'Editar' }}
              </button>
            }
          </div>
        </header>

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
                <h3 class="pd-block-title">Etiquetas</h3>
                @if (p.categoriaNombre) {
                  <span class="pd-tag">{{ p.categoriaNombre }}</span>
                } @else {
                  <p class="pd-block-empty">—</p>
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
            @if (editMode() && canEditProduct()) {
              <section class="pd-card pd-card--form">
                <h2 class="pd-card-title">Guardar cambios</h2>
                @if (formError()) {
                  <p class="error">{{ formError() }}</p>
                }
                <button type="button" class="pd-btn-save" [disabled]="form.invalid || saving()" (click)="save()">
                  {{ saving() ? 'Guardando…' : 'Guardar' }}
                </button>
              </section>
            }

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
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem;
      margin-bottom: 1.35rem;
      font-size: 0.8125rem;
    }

    .pd-back {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-weight: 600;
      color: var(--pd-primary);
      text-decoration: none;
      padding: 0.35rem 0.6rem;
      margin: -0.35rem -0.6rem;
      border-radius: 8px;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .pd-back-icon {
      font-size: 1rem;
      opacity: 0.85;
    }

    .pd-back:hover {
      background: var(--pd-primary-soft);
      color: var(--story-primary-hover, #1d4ed8);
    }

    .pd-back:focus-visible {
      outline: 2px solid var(--story-focus-ring, rgba(59, 130, 246, 0.45));
      outline-offset: 2px;
    }

    .pd-bc-sep {
      color: var(--pd-border);
      user-select: none;
    }

    .pd-bc-current {
      color: var(--pd-muted);
      font-weight: 500;
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
      margin-bottom: 1.5rem;
      padding: 1.35rem 1.5rem;
      background: var(--pd-card);
      border: 1px solid var(--pd-border);
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
      position: relative;
    }

    .pd-hero::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      border-radius: 16px 16px 0 0;
      background: linear-gradient(90deg, var(--pd-primary), var(--story-secondary, #3b82f6));
      opacity: 0.85;
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
      gap: 0.5rem;
    }

    .pd-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.6rem;
      height: 2.6rem;
      padding: 0;
      border: 1px solid var(--pd-border);
      border-radius: 10px;
      background: var(--pd-card);
      color: var(--pd-muted);
      cursor: pointer;
      transition:
        background 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;
    }

    .pd-icon-btn:hover:not(:disabled) {
      background: var(--pd-primary-soft);
      border-color: rgba(30, 64, 175, 0.25);
      color: var(--pd-primary);
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
      top: calc(100% + 6px);
      right: 0;
      min-width: 11rem;
      padding: 0.35rem 0;
      background: var(--pd-card);
      border: 1px solid var(--pd-border);
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
      z-index: 20;
    }

    .pd-more-item {
      display: block;
      width: 100%;
      padding: 0.5rem 1rem;
      border: none;
      background: transparent;
      font-size: 0.9rem;
      text-align: left;
      cursor: pointer;
      color: var(--pd-text);
    }

    .pd-more-item:hover {
      background: #f9fafb;
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

    .pd-btn-edit {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.55rem 1.1rem;
      border: none;
      border-radius: 10px;
      background: var(--pd-primary);
      color: var(--story-on-primary, #fff);
      font-size: 0.8125rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(30, 64, 175, 0.25);
      transition:
        background 0.18s ease,
        box-shadow 0.18s ease,
        transform 0.12s ease;
    }

    .pd-btn-edit:hover {
      background: var(--story-primary-hover, #1d4ed8);
      box-shadow: 0 3px 10px rgba(30, 64, 175, 0.3);
    }

    .pd-btn-edit:focus-visible {
      outline: 2px solid var(--story-focus-ring);
      outline-offset: 2px;
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
        border-color 0.15s ease,
        box-shadow 0.15s ease;
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
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
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
      background: var(--pd-bg);
      border-style: dashed;
    }

    .pd-card--barcode .pd-barcode-label {
      margin: 0 0 0.5rem;
      font-size: 0.75rem;
      color: var(--pd-muted);
    }

    .pd-barcode-num {
      margin: 0;
      padding: 0.65rem 0.75rem;
      font-family: ui-monospace, 'Cascadia Code', monospace;
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-align: center;
      color: var(--pd-text);
      background: var(--pd-card);
      border: 1px solid var(--pd-border);
      border-radius: 10px;
    }

    .pd-card--form .pd-btn-save {
      padding: 0.6rem 1.35rem;
      border: none;
      border-radius: 10px;
      background: var(--pd-primary);
      color: var(--story-on-primary, #fff);
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(30, 64, 175, 0.25);
      transition: background 0.18s ease, box-shadow 0.18s ease;
    }

    .pd-card--form .pd-btn-save:hover:not(:disabled) {
      background: var(--story-primary-hover, #1d4ed8);
      box-shadow: 0 3px 10px rgba(30, 64, 175, 0.28);
    }

    .pd-card--form .pd-btn-save:focus-visible {
      outline: 2px solid var(--story-focus-ring);
      outline-offset: 2px;
    }

    .pd-card--form .pd-btn-save:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .error {
      color: #b00020;
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

  private file: File | null = null;
  private productId: number | null = null;
  private readonly moreRootRef = viewChild<ElementRef<HTMLElement>>('moreRoot');
  private readonly movDialogRef = viewChild<ElementRef<HTMLDialogElement>>('movDialog');

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
    const root = this.moreRootRef()?.nativeElement;
    if (root && root.contains(ev.target as Node)) {
      return;
    }
    if (this.moreMenuOpen()) {
      this.moreMenuOpen.set(false);
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
