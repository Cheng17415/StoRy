import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { AccountApiService } from '../../core/services/account-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CompanyApiService } from '../../core/services/company-api.service';
import { CompanyPageDto, CompanyRole, CompanyMemberDto } from '../../core/models/company.models';

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
          <div class="company-hero-main">
            <div class="company-copy">
              <p class="eyebrow">Espacio de trabajo</p>
              <h1 id="company-title">{{ page.company.name }}</h1>
              <div class="role-row">
                <span class="role-pill" [class.role-pill--admin]="page.company.role === 'company_admin'">
                  {{ page.company.role === 'company_admin' ? 'Propietario' : page.company.role }}
                </span>
              </div>
            </div>
          </div>

          <div class="actions-row">
            <button class="btn btn-outline" type="button" (click)="openMembersModal()">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Miembros
            </button>
            @if (page.company.role === 'company_admin') {
              <button class="btn btn-primary" type="button" (click)="openInviteModal()">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                Invitar
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

        <section class="company-stats" aria-label="Resumen de empresa">
          <article class="stat-card">
            <span class="stat-icon stat-icon--blue" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div>
              <span class="stat-label">Miembros</span>
              <strong class="stat-value">{{ page.members.length }}</strong>
            </div>
          </article>
          <article class="stat-card">
            <span class="stat-icon stat-icon--amber" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </span>
            <div>
              <span class="stat-label">Invitaciones</span>
              <strong class="stat-value">{{ pendingInvitations().length }}</strong>
            </div>
          </article>
          <article class="stat-card">
            <span class="stat-icon stat-icon--green" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </span>
            <div>
              <span class="stat-label">Moneda</span>
              <strong class="stat-value">{{ page.company.currency }}</strong>
            </div>
          </article>
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

      <dialog #createDialog class="modal" (cancel)="$event.preventDefault()">
        <div class="modal-inner">
          <p class="modal-eyebrow">Nuevo espacio</p>
          <h2 class="modal-title">Crear empresa</h2>
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
            <div class="modal-actions">
              <button class="btn btn-outline" type="button" (click)="closeCreateModal()">Cancelar</button>
              <button class="btn btn-primary" type="submit" [disabled]="createForm.invalid || loading()">Crear</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog #joinDialog class="modal" (cancel)="$event.preventDefault()">
        <div class="modal-inner">
          <p class="modal-eyebrow">Acceso existente</p>
          <h2 class="modal-title">Unirse a empresa</h2>
          <form [formGroup]="joinForm" (ngSubmit)="joinCompany()">
            <label>
              Nombre
              <input type="text" formControlName="name" />
            </label>
            <label>
              Contraseña
              <input type="password" formControlName="password" />
            </label>
            <div class="modal-actions">
              <button class="btn btn-outline" type="button" (click)="closeJoinModal()">Cancelar</button>
              <button class="btn btn-primary" type="submit" [disabled]="joinForm.invalid || loading()">Unirme</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog #membersDialog class="modal" (cancel)="$event.preventDefault()">
        <div class="modal-inner">
          @if (companyPage(); as page) {
            <h2 class="modal-title">
              Miembros de <span class="accent">{{ page.company.name }}</span>
            </h2>
            <p class="modal-subtitle">Gestiona los miembros de tu organización.</p>
            <div class="members-list">
              <ul>
                @for (m of page.members; track m.userId) {
                  <li>
                    <span class="member-avatar" aria-hidden="true">{{ m.name.slice(0, 1).toUpperCase() }}</span>
                    <span class="member-main">
                      <span class="member-name">{{ m.name }}</span>
                      @if (m.email === currentEmail()) {
                        <span class="meta-you">(Tú)</span>
                      }
                    </span>
                    @if (page.company.role === 'company_admin') {
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
                    } @else {
                      <span class="member-role-readonly">{{ roleLabel(m.role) }}</span>
                    }
                  </li>
                }
                @for (i of pendingInvitations(); track i.id) {
                  <li>
                    <span class="member-avatar member-avatar--pending" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </span>
                    <span class="member-main">
                      <span class="member-name">{{ i.email }}</span>
                      <span class="meta">(Invitado - {{ i.role }})</span>
                    </span>
                  </li>
                }
              </ul>
            </div>
          }
          <div class="modal-actions">
            <button class="btn btn-outline" type="button" (click)="closeMembersModal()">Cerrar</button>
          </div>
        </div>
      </dialog>

      <dialog #inviteDialog class="modal" (cancel)="$event.preventDefault()">
        <div class="modal-inner">
          <p class="modal-eyebrow">Invitación</p>
          <h2 class="modal-title">Invitar miembro</h2>
          <p class="modal-subtitle">Envía invitaciones por correo asignando rol.</p>
          <form [formGroup]="inviteForm" (ngSubmit)="invite()">
            <label>
              Email
              <input type="email" formControlName="email" />
            </label>
            <label>
              Rol
              <select formControlName="role">
                <option value="employee">employee</option>
                <option value="analytics_viewer">analytics_viewer</option>
                <option value="company_admin">company_admin</option>
              </select>
            </label>
            <div class="modal-actions">
              <button class="btn btn-outline" type="button" (click)="closeInviteModal()">Cerrar</button>
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
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      padding: 1.6rem;
      background: #ffffff;
      border: 1px solid var(--story-border);
      border-radius: 20px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 10px 28px rgba(15, 23, 42, 0.05);
    }

    .company-hero-main {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: min(100%, 22rem);
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

    .role-note {
      color: #475569;
      font-size: 0.88rem;
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

    .company-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.75rem;
      margin: 1rem 0 0;
    }

    .stat-card {
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

    .stat-card:hover {
      border-color: var(--story-border-strong);
      transform: translateY(-1px);
    }

    .stat-icon {
      width: 2.35rem;
      height: 2.35rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 11px;
      flex-shrink: 0;
    }

    .stat-icon--blue { background: rgba(30, 64, 175, 0.10); color: var(--story-primary); }
    .stat-icon--amber { background: rgba(245, 158, 11, 0.14); color: var(--story-accent-muted); }
    .stat-icon--green { background: rgba(21, 128, 61, 0.10); color: var(--story-success); }

    .stat-label {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--story-text-muted);
    }

    .stat-value {
      display: block;
      margin-top: 0.1rem;
      font-size: 1.2rem;
      letter-spacing: -0.015em;
      color: #0f172a;
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
      width: min(100%, 530px);
      padding: 0;
      box-shadow: 0 25px 50px rgba(15, 23, 42, 0.2);
    }

    .modal::backdrop {
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
    }

    .modal-inner {
      padding: 1.35rem 1.5rem 1.25rem;
      background: var(--story-surface);
      color: var(--story-text);
      border-radius: 16px;
    }

    .modal-eyebrow {
      margin: 0 0 0.25rem;
      color: var(--story-primary);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .modal-title {
      margin: 0;
      font-size: 1.18rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
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

    .members-list {
      border: 1px solid var(--story-border);
      border-radius: 14px;
      max-height: 320px;
      overflow: auto;
      padding: 0.45rem;
      margin: 0.4rem 0 1rem;
      background: #f8fafc;
    }

    .members-list ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .members-list li {
      display: flex;
      align-items: center;
      gap: 0.7rem;
      padding: 0.65rem 0.7rem;
      border-radius: 10px;
      background: #ffffff;
      border: 1px solid var(--story-border);
      font-size: 0.9rem;
    }

    .member-role-select {
      margin-left: auto;
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
      margin-left: auto;
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

    .member-main {
      min-width: 0;
    }

    .member-name {
      color: #0f172a;
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .meta {
      color: var(--story-text-muted);
      font-size: 0.75rem;
      margin-left: 0.35rem;
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

      .company-hero-main {
        align-items: flex-start;
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
  private readonly companyApi = inject(CompanyApiService);
  private readonly accountApi = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly membersDialogRef = viewChild<ElementRef<HTMLDialogElement>>('membersDialog');
  private readonly inviteDialogRef = viewChild<ElementRef<HTMLDialogElement>>('inviteDialog');
  private readonly createDialogRef = viewChild<ElementRef<HTMLDialogElement>>('createDialog');
  private readonly joinDialogRef = viewChild<ElementRef<HTMLDialogElement>>('joinDialog');

  protected readonly loading = signal(false);
  protected readonly updatingMemberRoleUserId = signal<number | null>(null);
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

  protected pendingInvitations() {
    const page = this.companyPage();
    if (!page) return [];
    return page.invitations.filter((i) => i.status === 'PENDING');
  }

  protected currentEmail(): string {
    return this.auth.currentUser()?.email ?? '';
  }

  protected roleLabel(role: CompanyRole): string {
    switch (role) {
      case 'company_admin':
        return 'Propietario';
      case 'analytics_viewer':
        return 'Analítica';
      default:
        return 'Empleado';
    }
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

  protected openMembersModal(): void {
    this.membersDialogRef()?.nativeElement.showModal();
  }

  protected closeMembersModal(): void {
    this.membersDialogRef()?.nativeElement.close();
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
