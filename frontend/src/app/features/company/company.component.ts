import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, Observable, of, switchMap } from 'rxjs';
import { AccountApiService } from '../../core/services/account-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CompanyApiService } from '../../core/services/company-api.service';
import {
  CompanyCurrency,
  CompanyPageDto,
  CompanyRole,
  CompanyMemberDto,
} from '../../core/models/company.models';
import { isCompanyAdmin as checkCompanyAdmin, roleLabel } from '../../core/utils/company-role.util';
import { closeDialogOnBackdropClick } from '../../core/utils/dialog.util';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="company-page">
      @if (error()) {
        <p class="alert error" role="alert">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
          {{ error() }}
        </p>
      }
      @if (success()) {
        <p class="alert success" role="status">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" />
          </svg>
          {{ success() }}
        </p>
      }

      @if (companyPage(); as page) {
        <section class="company-hero" aria-labelledby="company-title">
          <div class="company-hero-top">
            <div class="company-copy">
              <p class="eyebrow">Espacio de trabajo</p>
              <h1 id="company-title">{{ page.company.name }}</h1>
              <div class="role-row">
                <span class="role-pill" [class.role-pill--admin]="isCompanyAdmin()">
                  {{ isCompanyAdmin() ? 'Propietario' : roleLabel(currentCompanyRole() ?? 'employee') }}
                </span>
                <span class="meta-currency">{{ currencyLabel(page.company.currency) }} ({{ page.company.currency }})</span>
              </div>
            </div>
            @if (isCompanyAdmin()) {
              <div class="co-more-wrap" #moreRoot>
                <button
                  type="button"
                  class="co-icon-btn"
                  [attr.aria-expanded]="moreMenuOpen()"
                  aria-haspopup="menu"
                  title="Opciones del espacio"
                  (click)="toggleMoreMenu($event)"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <circle cx="12" cy="5" r="2" fill="currentColor" />
                    <circle cx="12" cy="12" r="2" fill="currentColor" />
                    <circle cx="12" cy="19" r="2" fill="currentColor" />
                  </svg>
                </button>
                @if (moreMenuOpen()) {
                  <div class="co-more-panel" role="menu">
                    <button type="button" role="menuitem" class="co-more-item" (click)="openEditDialog()">
                      Editar empresa
                    </button>
                  </div>
                }
              </div>
            }
          </div>

          <div class="actions-row">
            @if (isCompanyAdmin()) {
              <button class="btn btn-primary" type="button" (click)="openInviteModal()">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                Invitar miembro
              </button>
            }
            <button class="btn btn-danger" type="button" (click)="leaveCompany()">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Abandonar
            </button>
          </div>
        </section>

        <section class="members-section" aria-labelledby="members-heading">
          <header class="members-header">
            <h2 id="members-heading">Miembros</h2>
            <span class="members-count">{{ page.members.length }} activos · {{ pendingInvitations().length }} invitaciones</span>
          </header>
          <div class="members-panel">
            <ul class="members-list">
              @for (m of page.members; track m.userId) {
                <li class="member-row">
                  <span class="member-avatar" aria-hidden="true">{{ m.name.slice(0, 1).toUpperCase() }}</span>
                  <div class="member-main">
                    <span class="member-name">{{ m.name }}</span>
                    <span class="member-email">{{ m.email }}</span>
                    @if (m.email === currentEmail()) {
                      <span class="meta-you">Tú</span>
                    }
                  </div>
                  <div class="member-actions">
                    @if (isCompanyAdmin()) {
                      <label class="member-role-select">
                        <span class="sr-only">Rol de {{ m.name }}</span>
                        <select
                          [value]="m.role"
                          [disabled]="updatingMemberRoleUserId() === m.userId || loading() || isSoleOwner(m, page.members)"
                          [title]="isSoleOwner(m, page.members) ? 'Debe haber al menos un propietario' : null"
                          (change)="changeMemberRole(m, page.members, $any($event.target).value)"
                        >
                          <option value="employee">{{ roleLabel('employee') }}</option>
                          <option value="analytics_viewer">{{ roleLabel('analytics_viewer') }}</option>
                          <option value="company_admin">{{ roleLabel('company_admin') }}</option>
                        </select>
                      </label>
                      @if (canRemoveMember(m, page.members)) {
                        <button
                          type="button"
                          class="member-remove-btn"
                          title="Eliminar de la empresa"
                          [disabled]="removingMemberUserId() === m.userId || loading()"
                          (click)="removeMember(m)"
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                            <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                          </svg>
                          <span class="sr-only">Eliminar {{ m.name }}</span>
                        </button>
                      }
                    } @else {
                      <span class="member-role-readonly">{{ roleLabel(m.role) }}</span>
                    }
                  </div>
                </li>
              }
              @for (i of pendingInvitations(); track i.id) {
                <li class="member-row member-row--pending">
                  <span class="member-avatar member-avatar--pending" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                      <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </span>
                  <div class="member-main">
                    <span class="member-name">{{ i.email }}</span>
                    <span class="member-email">Invitación pendiente · {{ roleLabel(i.role) }}</span>
                  </div>
                </li>
              }
            </ul>
          </div>
        </section>
      } @else {
        <div class="empty-state">
          <div class="empty-visual" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="42" height="42">
              <path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M4 21V7l8-4 8 4v14M9 21V11h6v10" />
            </svg>
          </div>
          <h1>Organiza tu inventario en equipo</h1>
          <p class="empty-state-text">Crea una empresa o únete a una existente para compartir productos, carpetas y roles.</p>
          <button class="btn btn-primary" type="button" (click)="openCreateModal()">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
            </svg>
            Crear empresa
          </button>
          <button class="btn btn-outline empty-state-second-btn" type="button" (click)="openJoinModal()">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
            </svg>
            Unirse a empresa
          </button>
        </div>
      }

      <dialog #createDialog class="modal" (click)="closeDialogOnBackdropClick($event, closeCreateModal.bind(this))">
        <div class="modal-inner">
          <div class="modal-head-bar">
            <div class="modal-head-bar__main">
              <p class="modal-eyebrow">Nuevo espacio</p>
              <h2 class="modal-title">Crear empresa</h2>
            </div>
            <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeCreateModal()">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form [formGroup]="createForm" (ngSubmit)="createCompany()">
            <label>
              Nombre
              <input type="text" formControlName="name" />
            </label>
            <label>
              Contraseña
              <input type="password" formControlName="password" />
            </label>
            <label>
              Moneda
              <select formControlName="currency">
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="JPY">JPY</option>
                <option value="CNY">CNY</option>
              </select>
            </label>
            <div class="modal-actions modal-actions--end">
              <button class="btn btn-primary" type="submit" [disabled]="createForm.invalid || loading()">Crear</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog #joinDialog class="modal" (click)="closeDialogOnBackdropClick($event, closeJoinModal.bind(this))">
        <div class="modal-inner">
          <div class="modal-head-bar">
            <div class="modal-head-bar__main">
              <p class="modal-eyebrow">Acceso existente</p>
              <h2 class="modal-title">Unirse a empresa</h2>
            </div>
            <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeJoinModal()">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form [formGroup]="joinForm" (ngSubmit)="joinCompany()">
            <label>
              Nombre
              <input type="text" formControlName="name" />
            </label>
            <label>
              Contraseña
              <input type="password" formControlName="password" />
            </label>
            <div class="modal-actions modal-actions--end">
              <button class="btn btn-primary" type="submit" [disabled]="joinForm.invalid || loading()">Unirme</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog #editDialog class="modal modal--company-edit" (click)="closeDialogOnBackdropClick($event, closeEditDialog.bind(this))">
        <div class="modal-inner modal-inner--company-edit">
          <header class="company-edit-head modal-head-bar">
            <div class="modal-head-bar__main">
              <p class="modal-eyebrow">Espacio de trabajo</p>
              <h3 class="modal-title">Editar empresa</h3>
            </div>
            <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeEditDialog()">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="company-edit-scroll">
            <form
              id="company-settings-form"
              class="company-edit-form"
              [formGroup]="settingsForm"
              (ngSubmit)="onSaveSettings()"
            >
              <section class="ce-section" aria-labelledby="ce-info-title">
                <div class="ce-section-head">
                  <span class="ce-section-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M4 21V7l8-4 8 4v14M9 21V11h6v10" />
                    </svg>
                  </span>
                  <div>
                    <h4 id="ce-info-title" class="ce-section-title">Información del espacio</h4>
                  </div>
                </div>
                <label class="ce-field ce-field--full">
                  <span class="field-label">Nombre <span class="required-mark" aria-hidden="true">*</span></span>
                  <input
                    type="text"
                    class="ce-input"
                    formControlName="name"
                    autocomplete="organization"
                    placeholder="Nombre de la empresa"
                  />
                </label>
                <label class="ce-field">
                  <span class="field-label">Moneda <span class="required-mark" aria-hidden="true">*</span></span>
                  <select class="ce-input ce-input--select" formControlName="currency">
                    @for (c of currencyOptions; track c) {
                      <option [value]="c">{{ currencyLabel(c) }} ({{ c }})</option>
                    }
                  </select>
                </label>
                @if (settingsFeedback()) {
                  <p
                    class="ce-feedback"
                    [class.ce-feedback--error]="settingsFeedback()!.kind === 'error'"
                    [class.ce-feedback--ok]="settingsFeedback()!.kind === 'ok'"
                    role="alert"
                  >
                    {{ settingsFeedback()!.text }}
                  </p>
                }
                <div class="ce-settings-actions">
                  <button
                    type="submit"
                    class="btn-submit"
                    [disabled]="settingsForm.invalid || savingSettings()"
                  >
                    {{ savingSettings() ? 'Guardando…' : 'Guardar cambios' }}
                  </button>
                </div>
              </section>
            </form>

            <form
              id="company-password-form"
              class="company-edit-form"
              [formGroup]="passwordForm"
              (ngSubmit)="onChangeCompanyPassword()"
            >
              <section class="ce-section ce-section--accent" aria-labelledby="ce-pass-title">
                <div class="ce-section-head">
                  <span class="ce-section-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 11V7a4 4 0 1 0-8 0v4M5 11h14v10H5V11z" />
                    </svg>
                  </span>
                  <div>
                    <h4 id="ce-pass-title" class="ce-section-title">Contraseña de acceso</h4>
                  </div>
                </div>
                <div class="ce-metrics">
                  <label class="ce-field">
                    <span class="field-label">Contraseña actual <span class="required-mark" aria-hidden="true">*</span></span>
                    <input
                      type="password"
                      class="ce-input"
                      formControlName="currentPassword"
                      autocomplete="current-password"
                      placeholder="••••••••"
                    />
                  </label>
                  <label class="ce-field">
                    <span class="field-label">Nueva contraseña <span class="required-mark" aria-hidden="true">*</span></span>
                    <input
                      type="password"
                      class="ce-input"
                      formControlName="newPassword"
                      autocomplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </label>
                </div>
                @if (passwordFeedback()) {
                  <p
                    class="ce-feedback"
                    [class.ce-feedback--error]="passwordFeedback()!.kind === 'error'"
                    [class.ce-feedback--ok]="passwordFeedback()!.kind === 'ok'"
                    role="alert"
                  >
                    {{ passwordFeedback()!.text }}
                  </p>
                }
                <div class="ce-settings-actions">
                  <button
                    type="submit"
                    class="btn-secondary btn-secondary--outline"
                    [disabled]="passwordForm.invalid || savingPassword()"
                  >
                    {{ savingPassword() ? 'Actualizando…' : 'Actualizar contraseña' }}
                  </button>
                </div>
              </section>
            </form>
          </div>
        </div>
      </dialog>

      <dialog #inviteDialog class="modal" (click)="closeDialogOnBackdropClick($event, closeInviteModal.bind(this))">
        <div class="modal-inner">
          <div class="modal-head-bar">
            <div class="modal-head-bar__main">
              <p class="modal-eyebrow">Invitación</p>
              <h2 class="modal-title">Invitar miembro</h2>
              <p class="modal-subtitle">Envía invitaciones por correo asignando rol.</p>
            </div>
            <button type="button" class="modal-close" aria-label="Cerrar" (click)="closeInviteModal()">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <form [formGroup]="inviteForm" (ngSubmit)="invite()">
            <label>
              Email
              <input type="email" formControlName="email" />
            </label>
            <label>
              Rol
              <select formControlName="role">
                <option value="employee">{{ roleLabel('employee') }}</option>
                <option value="analytics_viewer">{{ roleLabel('analytics_viewer') }}</option>
                <option value="company_admin">{{ roleLabel('company_admin') }}</option>
              </select>
            </label>
            <div class="modal-actions modal-actions--end">
              <button class="btn btn-primary" type="submit" [disabled]="inviteForm.invalid || loading()">
                Enviar invitación
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </section>
  `,
  styles: `
    :host {
      display: block;
      --inv-cta: var(--story-primary);
      --inv-cta-hover: var(--story-primary-hover);
      --inv-text: #0f172a;
      --inv-text-soft: #334155;
      --inv-muted: #64748b;
      --inv-border: #e2e8f0;
      --inv-border-strong: #cbd5e1;
      --inv-surface: #ffffff;
      --inv-danger: var(--story-danger);
      --inv-focus-ring: 0 0 0 3px var(--story-focus-ring);
    }

    .company-page {
      max-width: 68rem;
      margin: 0 auto;
      padding: 0.75rem 1rem 3rem;
    }

    .alert {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0 0 0.85rem;
      padding: 0.7rem 0.9rem;
      border-radius: 12px;
      font-size: 0.88rem;
      font-weight: 500;
      border: 1px solid transparent;
    }

    .alert svg {
      flex-shrink: 0;
    }

    .error {
      color: var(--story-danger);
      background: rgba(185, 28, 28, 0.07);
      border-color: rgba(185, 28, 28, 0.2);
    }

    .success {
      color: var(--story-success);
      background: rgba(21, 128, 61, 0.08);
      border-color: rgba(21, 128, 61, 0.18);
    }

    .company-hero {
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      padding: 1.6rem;
      background: #ffffff;
      border: 1px solid var(--story-border);
      border-radius: 20px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(15, 23, 42, 0.05);
    }

    .company-hero-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .company-copy {
      min-width: 0;
    }

    .eyebrow {
      margin: 0 0 0.25rem;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--story-primary);
    }

    .company-copy h1 {
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.15rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
      color: #0f172a;
    }

    .role-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.55rem;
      margin-top: 0.65rem;
    }

    .role-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      background: rgba(30, 64, 175, 0.08);
      color: var(--story-primary);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .role-pill--admin {
      background: rgba(245, 158, 11, 0.14);
      color: var(--story-accent-muted);
    }

    .meta-currency {
      font-size: 0.82rem;
      color: var(--story-text-muted);
      font-weight: 500;
    }

    .co-more-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .co-icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      padding: 0;
      border: 1px solid var(--story-border);
      border-radius: 12px;
      background: #fff;
      color: #334155;
      cursor: pointer;
      transition: background 0.12s ease, border-color 0.12s ease;
    }

    .co-icon-btn:hover {
      background: #f8fafc;
      border-color: var(--story-border-strong);
    }

    .co-more-panel {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      min-width: 13rem;
      padding: 0.4rem;
      background: #fff;
      border: 1px solid var(--story-border);
      border-radius: 12px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14), 0 0 1px rgba(15, 23, 42, 0.08);
      z-index: 80;
    }

    .co-more-item {
      display: block;
      width: 100%;
      padding: 0.55rem 0.75rem;
      border: none;
      border-radius: 8px;
      background: transparent;
      font-size: 0.88rem;
      text-align: left;
      cursor: pointer;
      color: #0f172a;
      transition: background 0.12s ease;
    }

    .co-more-item:hover {
      background: #f1f5f9;
    }

    .actions-row {
      position: relative;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.45rem;
      padding: 0.25rem;
      background: #f1f5f9;
      border: 1px solid var(--story-border);
      border-radius: 14px;
    }

    .members-section {
      margin-top: 1.25rem;
    }

    .members-header {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .members-header h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
    }

    .members-count {
      font-size: 0.82rem;
      color: var(--story-text-muted);
      font-weight: 500;
    }

    .members-panel {
      border: 1px solid var(--story-border);
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
      overflow: hidden;
    }

    .members-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .member-row {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--story-border);
    }

    .member-row:last-child {
      border-bottom: none;
    }

    .member-row--pending {
      background: #fafbfc;
    }

    .member-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.35rem 0.65rem;
    }

    .member-name {
      font-weight: 600;
      color: #0f172a;
      font-size: 0.92rem;
    }

    .member-email {
      width: 100%;
      font-size: 0.8rem;
      color: var(--story-text-muted);
      overflow-wrap: anywhere;
    }

    .member-row--pending .member-email {
      width: auto;
    }

    .member-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-shrink: 0;
    }

    .member-remove-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: 1px solid rgba(185, 28, 28, 0.2);
      border-radius: 10px;
      background: rgba(185, 28, 28, 0.06);
      color: var(--story-danger);
      cursor: pointer;
      transition: background 0.12s ease;
    }

    .member-remove-btn:hover:not(:disabled) {
      background: rgba(185, 28, 28, 0.12);
    }

    .member-remove-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .empty-state {
      text-align: center;
      padding: 3rem 1.5rem;
      border: 1px solid var(--story-border);
      border-radius: 22px;
      background:
        radial-gradient(700px 260px at 50% 0%, rgba(30, 64, 175, 0.12), transparent 70%),
        linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(15, 23, 42, 0.05);
    }

    .empty-visual {
      width: 5rem;
      height: 5rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 22px;
      margin-bottom: 1.1rem;
      background: rgba(30, 64, 175, 0.08);
      color: var(--story-primary);
    }

    .empty-state h1 {
      margin: 0 0 0.55rem;
      color: #0f172a;
      font-size: clamp(1.45rem, 3vw, 2rem);
      letter-spacing: -0.025em;
    }

    .empty-state-text {
      color: #475569;
      margin: 0 auto 1.25rem;
      max-width: 32rem;
      font-size: 0.98rem;
      line-height: 1.6;
    }

    .empty-state-second-btn {
      margin-left: 0.5rem;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin-top: 1rem;
    }

    label {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.84rem;
      font-weight: 600;
      color: #334155;
    }

    input,
    select {
      min-height: 2.55rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 10px;
      background: var(--story-surface);
      color: #0f172a;
      font: inherit;
      font-size: 0.92rem;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    input:focus-visible,
    select:focus-visible {
      outline: none;
      border-color: var(--story-primary);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    select {
      cursor: pointer;
    }

    .btn {
      width: fit-content;
      min-height: 2.35rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0 0.95rem;
      border: 1px solid transparent;
      border-radius: 10px;
      background: var(--story-primary);
      color: var(--story-on-primary);
      cursor: pointer;
      font: inherit;
      font-size: 0.86rem;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.05s ease;
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.22);
    }

    .btn:hover:not(:disabled) {
      background: var(--story-primary-hover);
      border-color: var(--story-primary-hover);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.28);
    }

    .btn:active:not(:disabled) {
      transform: translateY(1px);
    }

    .btn:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      box-shadow: none;
    }

    .btn-outline {
      background: transparent;
      border-color: transparent;
      color: #334155;
      box-shadow: none;
    }

    .btn-outline:hover:not(:disabled) {
      border-color: var(--story-border);
      color: var(--story-primary);
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
    }

    .btn-primary {
      background: var(--story-primary);
      color: var(--story-on-primary);
      border-color: var(--story-primary);
      box-shadow: 0 4px 12px rgba(30, 64, 175, 0.25);
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--story-primary-hover);
      border-color: var(--story-primary-hover);
      box-shadow: 0 6px 16px rgba(30, 64, 175, 0.3);
    }

    .btn-danger {
      background: transparent;
      color: var(--story-danger);
      border-color: transparent;
      box-shadow: none;
    }

    .btn-danger:hover:not(:disabled) {
      background: rgba(185, 28, 28, 0.08);
      border-color: rgba(185, 28, 28, 0.16);
      box-shadow: none;
    }

    .modal {
      border: none;
      border-radius: 16px;
      padding: 0;
      max-width: 26rem;
      width: calc(100vw - 2rem);
      box-shadow: 0 25px 50px rgba(15, 23, 42, 0.2);
    }

    .modal--company-edit {
      max-width: min(34rem, calc(100vw - 1.5rem));
    }

    .modal::backdrop {
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(4px);
    }

    .modal-inner {
      padding: 1.35rem;
      background: var(--inv-surface);
      border-radius: 16px;
    }

    .modal-inner--company-edit {
      padding: 0;
      display: flex;
      flex-direction: column;
      max-height: min(90vh, 52rem);
      overflow: hidden;
    }

    .company-edit-head {
      padding: 1.15rem 1.5rem 0.65rem;
      flex-shrink: 0;
      border-bottom: 1px solid var(--inv-border);
    }

    .modal-actions--end {
      justify-content: flex-end;
    }

    .modal-eyebrow {
      margin: 0 0 0.2rem;
      color: var(--inv-cta);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .modal-title {
      margin: 0;
      font-size: 1.22rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--inv-text);
    }

    .company-edit-scroll {
      overflow-y: auto;
      padding: 1rem 1.5rem 1.25rem;
      flex: 1;
      min-height: 0;
    }

    .company-edit-form {
      display: block;
    }

    .ce-section {
      padding: 0 0 1.1rem;
      margin-bottom: 1.1rem;
      border-bottom: 1px solid var(--inv-border);
    }

    .ce-section:not(.ce-section--accent):last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0.25rem;
    }

    .ce-section--accent {
      padding: 0.85rem 1rem 1rem;
      margin-bottom: 0;
      border: 1px solid var(--inv-border);
      border-radius: 12px;
      background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
    }

    .ce-section-head {
      display: flex;
      gap: 0.65rem;
      align-items: flex-start;
      margin-bottom: 0.85rem;
    }

    .ce-section-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 8px;
      background: rgba(30, 64, 175, 0.1);
      color: var(--inv-cta);
      flex-shrink: 0;
    }

    .ce-section-title {
      margin: 0;
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--inv-text);
    }

    .ce-section-hint {
      margin: 0.15rem 0 0;
      font-size: 0.78rem;
      font-weight: 400;
      color: var(--inv-muted);
      line-height: 1.4;
    }

    .ce-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.65rem;
    }

    .ce-field {
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      min-width: 0;
    }

    .ce-field--full {
      margin-bottom: 0.65rem;
    }

    .field-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--inv-text-soft);
    }

    .required-mark {
      color: var(--inv-danger);
    }

    .ce-input {
      width: 100%;
      padding: 0.55rem 0.7rem;
      border: 1px solid var(--inv-border-strong);
      border-radius: 10px;
      font: inherit;
      background: #ffffff;
      color: var(--inv-text);
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .ce-input--select {
      cursor: pointer;
    }

    .ce-input:focus {
      outline: none;
      border-color: var(--inv-cta);
      box-shadow: var(--inv-focus-ring);
    }

    .ce-feedback {
      margin: 0.75rem 0 0;
      padding: 0.5rem 0.65rem;
      font-size: 0.85rem;
      border-radius: 8px;
    }

    .ce-feedback--ok {
      background: #e6f4ea;
      color: #137333;
    }

    .ce-feedback--error {
      background: #fce8e6;
      color: #c5221f;
    }

    .ce-settings-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.85rem;
      padding-top: 0.15rem;
    }

    .btn-secondary {
      padding: 0.6rem 1.05rem;
      border-radius: 10px;
      border: 1px solid var(--inv-border-strong);
      background: #ffffff;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      font-size: 0.88rem;
      color: var(--inv-text-soft);
      transition: border-color 0.18s ease, background 0.18s ease;
    }

    .btn-secondary:hover:not(:disabled) {
      border-color: #94a3b8;
      background: #f8fafc;
    }

    .btn-secondary--outline {
      color: var(--inv-cta);
      border-color: rgba(30, 64, 175, 0.35);
      background: rgba(30, 64, 175, 0.04);
    }

    .btn-secondary--outline:hover:not(:disabled) {
      background: rgba(30, 64, 175, 0.08);
      border-color: var(--inv-cta);
    }

    .btn-secondary:disabled,
    .btn-submit:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-submit {
      padding: 0.6rem 1.1rem;
      border: 1px solid var(--inv-cta);
      border-radius: 10px;
      background: var(--inv-cta);
      color: #fff;
      font: inherit;
      font-weight: 600;
      font-size: 0.88rem;
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

    @media (max-width: 520px) {
      .ce-metrics {
        grid-template-columns: 1fr;
      }

      .company-edit-head,
      .company-edit-scroll {
        padding-left: 1.1rem;
        padding-right: 1.1rem;
      }

      .ce-settings-actions .btn-secondary,
      .ce-settings-actions .btn-submit {
        width: 100%;
      }
    }

    .modal-subtitle {
      margin: 0.4rem 0 1rem;
      color: #475569;
      font-size: 0.88rem;
      line-height: 1.5;
    }

    .accent {
      color: var(--story-primary);
      font-weight: 700;
    }

    .member-role-select {
      flex-shrink: 0;
    }

    .member-role-select select {
      min-height: 2rem;
      padding: 0.35rem 0.55rem;
      font-size: 0.8rem;
      min-width: 8.5rem;
    }

    .member-role-select select:disabled {
      cursor: not-allowed;
      opacity: 0.65;
      background: #f1f5f9;
    }

    .member-role-readonly {
      flex-shrink: 0;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--story-text-muted);
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

    .member-avatar {
      width: 2rem;
      height: 2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 9px;
      background: rgba(30, 64, 175, 0.10);
      color: var(--story-primary);
      font-weight: 800;
      flex-shrink: 0;
    }

    .member-avatar--pending {
      background: rgba(245, 158, 11, 0.14);
      color: var(--story-accent-muted);
    }

    .meta-you {
      display: inline-flex;
      margin-left: 0.35rem;
      padding: 0.12rem 0.4rem;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.12);
      color: var(--story-primary);
      font-size: 0.72rem;
      font-weight: 700;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    @media (max-width: 640px) {
      .company-hero {
        padding: 1.35rem;
      }

      .company-hero-top {
        flex-direction: column;
        align-items: stretch;
      }

      .member-row {
        flex-wrap: wrap;
      }

      .member-actions {
        width: 100%;
        justify-content: flex-end;
      }

      .actions-row {
        width: 100%;
      }

      .empty-state-second-btn {
        margin: 0.5rem 0 0;
      }

      .modal-actions {
        flex-wrap: wrap;
      }
    }
  `,
})
export class CompanyComponent {
  protected readonly closeDialogOnBackdropClick = closeDialogOnBackdropClick;
  private readonly companyApi = inject(CompanyApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly moreRootRef = viewChild<ElementRef<HTMLElement>>('moreRoot');
  private readonly editDialogRef = viewChild<ElementRef<HTMLDialogElement>>('editDialog');
  private readonly inviteDialogRef = viewChild<ElementRef<HTMLDialogElement>>('inviteDialog');
  private readonly createDialogRef = viewChild<ElementRef<HTMLDialogElement>>('createDialog');
  private readonly joinDialogRef = viewChild<ElementRef<HTMLDialogElement>>('joinDialog');

  protected readonly currencyOptions: CompanyCurrency[] = ['EUR', 'USD', 'JPY', 'CNY'];
  protected readonly moreMenuOpen = signal(false);

  protected readonly loading = signal(false);
  protected readonly updatingMemberRoleUserId = signal<number | null>(null);
  protected readonly removingMemberUserId = signal<number | null>(null);
  protected readonly savingSettings = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly settingsFeedback = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  protected readonly passwordFeedback = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly companyPage = signal<CompanyPageDto | null>(null);

  protected readonly createForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    currency: ['EUR' as const, Validators.required],
  });

  protected readonly joinForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly inviteForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    role: ['employee' as CompanyRole, Validators.required],
  });

  protected readonly settingsForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    currency: ['EUR' as CompanyCurrency, Validators.required],
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected pendingInvitations() {
    const page = this.companyPage();
    if (!page) return [];
    return page.invitations.filter((i) => i.status === 'PENDING');
  }

  protected currentEmail(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  /** Rol en sesión (misma fuente que /productos y estadisticasGuard). */
  protected readonly roleLabel = roleLabel;

  protected currentCompanyRole(): CompanyRole | null {
    return this.auth.currentUser()?.companyRole ?? null;
  }

  protected isCompanyAdmin(): boolean {
    return checkCompanyAdmin(this.currentCompanyRole());
  }

  protected currencyLabel(currency: CompanyCurrency): string {
    switch (currency) {
      case 'USD':
        return 'Dólar';
      case 'JPY':
        return 'Yen';
      case 'CNY':
        return 'Yuan';
      default:
        return 'Euro';
    }
  }

  protected canRemoveMember(member: CompanyMemberDto, members: CompanyMemberDto[]): boolean {
    if (!this.isCompanyAdmin()) return false;
    if (member.email === this.currentEmail()) return false;
    if (this.isSoleOwner(member, members)) return false;
    return true;
  }

  protected removeMember(member: CompanyMemberDto): void {
    if (!this.canRemoveMember(member, this.companyPage()?.members ?? [])) return;
    if (!globalThis.confirm(`¿Eliminar a ${member.name} de la empresa?`)) return;
    this.removingMemberUserId.set(member.userId);
    this.error.set('');
    this.success.set('');
    this.companyApi
      .removeMember(member.userId)
      .pipe(switchMap(() => this.refreshPageObservable()))
      .subscribe({
        next: () => {
          this.removingMemberUserId.set(null);
          this.success.set(`${member.name} eliminado de la empresa.`);
        },
        error: (err: { error?: { message?: string } }) => {
          this.removingMemberUserId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo eliminar el miembro.');
          this.refreshPage();
        },
      });
  }

  protected toggleMoreMenu(ev: Event): void {
    ev.stopPropagation();
    this.moreMenuOpen.update((o) => !o);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(ev: MouseEvent): void {
    const moreRoot = this.moreRootRef()?.nativeElement;
    if (!moreRoot?.contains(ev.target as Node) && this.moreMenuOpen()) {
      this.moreMenuOpen.set(false);
    }
  }

  protected openEditDialog(): void {
    this.moreMenuOpen.set(false);
    const page = this.companyPage();
    if (page) {
      this.settingsForm.patchValue({
        name: page.company.name,
        currency: page.company.currency,
      });
    }
    this.settingsFeedback.set(null);
    this.passwordFeedback.set(null);
    this.passwordForm.reset({ currentPassword: '', newPassword: '' });
    this.editDialogRef()?.nativeElement.showModal();
  }

  protected closeEditDialog(): void {
    this.editDialogRef()?.nativeElement.close();
  }

  protected onSaveSettings(): void {
    if (!this.isCompanyAdmin() || this.settingsForm.invalid) return;
    const page = this.companyPage();
    if (!page) return;

    const { name, currency } = this.settingsForm.getRawValue();
    const trimmedName = name.trim();
    const nameChanged = trimmedName !== page.company.name;
    const currencyChanged = currency !== page.company.currency;
    if (!nameChanged && !currencyChanged) {
      this.settingsFeedback.set({ kind: 'ok', text: 'No hay cambios que guardar.' });
      return;
    }

    const updates: Observable<unknown>[] = [];
    if (nameChanged) {
      updates.push(this.companyApi.updateName({ name: trimmedName }));
    }
    if (currencyChanged) {
      updates.push(this.companyApi.updateCurrency({ currency }));
    }

    this.settingsFeedback.set(null);
    this.savingSettings.set(true);
    forkJoin(updates)
      .pipe(switchMap(() => this.refreshUserAndPage()))
      .subscribe({
        next: () => {
          this.savingSettings.set(false);
          this.settingsFeedback.set({ kind: 'ok', text: 'Cambios guardados.' });
          this.success.set('Empresa actualizada.');
        },
        error: (err: { error?: { message?: string } }) => {
          this.savingSettings.set(false);
          this.settingsFeedback.set({
            kind: 'error',
            text: err?.error?.message ?? 'No se pudieron guardar los cambios.',
          });
        },
      });
  }

  protected onChangeCompanyPassword(): void {
    if (!this.isCompanyAdmin() || this.passwordForm.invalid) return;
    this.passwordFeedback.set(null);
    this.savingPassword.set(true);
    this.companyApi
      .updatePassword(this.passwordForm.getRawValue())
      .pipe(switchMap(() => this.refreshUserAndPage()))
      .subscribe({
        next: () => {
          this.savingPassword.set(false);
          this.passwordForm.reset({ currentPassword: '', newPassword: '' });
          this.passwordFeedback.set({ kind: 'ok', text: 'Contraseña actualizada.' });
        },
        error: (err: { error?: { message?: string } }) => {
          this.savingPassword.set(false);
          this.passwordFeedback.set({
            kind: 'error',
            text: err?.error?.message ?? 'No se pudo cambiar la contraseña.',
          });
        },
      });
  }

  protected ownerCount(members: CompanyMemberDto[]): number {
    return members.filter((m) => m.role === 'company_admin').length;
  }

  protected isSoleOwner(member: CompanyMemberDto, members: CompanyMemberDto[]): boolean {
    return member.role === 'company_admin' && this.ownerCount(members) === 1;
  }

  protected canChangeMemberRole(
    member: CompanyMemberDto,
    members: CompanyMemberDto[],
    role: CompanyRole,
  ): boolean {
    if (member.role === role) return false;
    if (member.role === 'company_admin' && role !== 'company_admin' && this.ownerCount(members) <= 1) {
      return false;
    }
    return true;
  }

  protected changeMemberRole(
    member: CompanyMemberDto,
    members: CompanyMemberDto[],
    role: CompanyRole,
  ): void {
    if (!this.canChangeMemberRole(member, members, role)) return;
    this.updatingMemberRoleUserId.set(member.userId);
    this.error.set('');
    this.success.set('');
    this.companyApi
      .updateMemberRole(member.userId, { role })
      .pipe(switchMap(() => this.refreshUserAndPage()))
      .subscribe({
        next: () => {
          this.updatingMemberRoleUserId.set(null);
          this.success.set(`Rol de ${member.name} actualizado.`);
        },
        error: (err: { error?: { message?: string } }) => {
          this.updatingMemberRoleUserId.set(null);
          this.error.set(err?.error?.message ?? 'No se pudo cambiar el rol.');
          this.refreshPage();
        },
      });
  }

  constructor() {
    this.refreshPage();
    this.route.queryParamMap.subscribe((qp) => {
      const token = qp.get('inviteToken');
      if (!token) return;
      this.loading.set(true);
      this.error.set('');
      this.success.set('');
      this.companyApi.acceptInvitation(token).pipe(switchMap(() => this.refreshUserAndPage())).subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Invitacion aceptada.');
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo aceptar la invitacion.');
        },
      });
    });
  }

  protected createCompany(): void {
    if (this.createForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.companyApi
      .createCompany(this.createForm.getRawValue())
      .pipe(switchMap(() => this.refreshUserAndPage()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Empresa creada.');
          this.closeCreateModal();
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo crear la empresa.');
        },
      });
  }

  protected joinCompany(): void {
    if (this.joinForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.companyApi
      .joinCompany(this.joinForm.getRawValue())
      .pipe(switchMap(() => this.refreshUserAndPage()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Te uniste a la empresa.');
          this.closeJoinModal();
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo unir a la empresa.');
        },
      });
  }

  protected leaveCompany(): void {
    if (!globalThis.confirm('¿Seguro que quieres abandonar la empresa?')) return;
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.companyApi
      .leaveCompany()
      .pipe(switchMap(() => this.refreshUserAndPage()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Has abandonado la empresa.');
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo abandonar la empresa.');
        },
      });
  }

  protected invite(): void {
    if (this.inviteForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.companyApi
      .inviteMember(this.inviteForm.getRawValue())
      .pipe(switchMap(() => this.refreshPageObservable()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.success.set('Invitacion enviada.');
          this.inviteForm.patchValue({ email: '', role: 'employee' });
          this.closeInviteModal();
        },
        error: (err: { error?: { message?: string } }) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'No se pudo enviar la invitacion.');
        },
      });
  }

  protected openInviteModal(): void {
    this.inviteDialogRef()?.nativeElement.showModal();
  }

  protected closeInviteModal(): void {
    this.inviteDialogRef()?.nativeElement.close();
  }

  protected openCreateModal(): void {
    this.createDialogRef()?.nativeElement.showModal();
  }

  protected closeCreateModal(): void {
    this.createDialogRef()?.nativeElement.close();
  }

  protected openJoinModal(): void {
    this.joinDialogRef()?.nativeElement.showModal();
  }

  protected closeJoinModal(): void {
    this.joinDialogRef()?.nativeElement.close();
  }

  private refreshPage(): void {
    this.refreshPageObservable().subscribe({
      error: () => {
        this.companyPage.set(null);
      },
    });
  }

  private refreshPageObservable() {
    return this.companyApi.getCompanyPage().pipe(
      switchMap((page) => {
        this.companyPage.set(page);
        return of(page);
      }),
    );
  }

  private refreshUserAndPage() {
    return forkJoin([
      this.accountApi.getProfile(),
      this.companyApi.getCompanyPage().pipe(catchError(() => of(null))),
    ]).pipe(
      switchMap(([user, page]) => {
        this.auth.updateStoredUser(user);
        this.companyPage.set(page);
        return of(page);
      }),
    );
  }
}
