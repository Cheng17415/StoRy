import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { AccountApiService } from '../../core/services/account-api.service';
import { AuthService } from '../../core/services/auth.service';
import { CompanyApiService } from '../../core/services/company-api.service';
import { CompanyPageDto, CompanyRole } from '../../core/models/company.models';

@Component({
  selector: 'app-company',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="container">
      @if (error()) {
        <p class="alert error">{{ error() }}</p>
      }
      @if (success()) {
        <p class="alert success">{{ success() }}</p>
      }

      @if (companyPage(); as page) {
        <section class="card">
          <h2 class="card-title">Tu empresa</h2>
          <div class="org-name-row">
            <p class="org-name">{{ page.company.name }}</p>
            <span class="org-role-note"
              >(Eres {{ page.company.role === 'company_admin' ? 'el propietario' : page.company.role }})</span
            >
          </div>
          <div class="actions-row">
            <button class="btn btn-outline" type="button" (click)="openMembersModal()">Miembros</button>
            @if (page.company.role === 'company_admin') {
              <button class="btn btn-outline" type="button" (click)="openInviteModal()">Invitar</button>
            }
            <button class="btn btn-danger" type="button" (click)="leaveCompany()">Abandonar</button>
          </div>
        </section>
      } @else {
        <div class="empty-state">
          <p class="empty-state-text">No perteneces a ninguna empresa.</p>
          <button class="btn btn-primary" type="button" (click)="openCreateModal()">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>
            Crear empresa
          </button>
          <button class="btn btn-outline empty-state-second-btn" type="button" (click)="openJoinModal()">
            Unirse a empresa
          </button>
        </div>
      }

      <dialog #createDialog class="modal" (cancel)="$event.preventDefault()">
        <div class="modal-inner">
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
              Miembros de "<span class="accent">{{ page.company.name }}</span>"
            </h2>
            <p class="modal-subtitle">Gestiona los miembros de tu organizacion.</p>
            <div class="members-list">
              <ul>
                @for (m of page.members; track m.userId) {
                  <li>
                    <span>
                      {{ m.name }}
                      @if (m.role === 'company_admin') {
                        <span class="meta">(Propietario)</span>
                      }
                      @if (m.email === currentEmail()) {
                        <span class="meta-you">(Tú)</span>
                      }
                    </span>
                  </li>
                }
                @for (i of pendingInvitations(); track i.id) {
                  <li>
                    <span>
                      {{ i.email }}
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
          <h2 class="modal-title">Invitar miembro</h2>
          <p class="modal-subtitle">Envia invitaciones por correo asignando rol.</p>
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
              <button class="btn" type="submit" [disabled]="inviteForm.invalid || loading()">
                Enviar invitacion
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </section>
  `,
  styles: `
    .container { max-width: 1100px; margin: 1rem auto 0; padding: 1rem; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 1.2rem; }
    @media (min-width: 768px) { .grid { grid-template-columns: 1fr 1fr; } }
    .card { border: 1px solid var(--story-border); border-radius: 8px; background: var(--story-surface); box-shadow: 0 1px 2px rgb(15 23 42 / 0.06); padding: 1rem; }
    .card-title { margin: 0 0 0.6rem; font-size: 1.1rem; font-weight: 600; color: var(--story-text); }
    .org-name-row { display: flex; align-items: baseline; gap: 0.5rem; margin-left: 0.3rem; }
    .org-name { margin: 0; font-size: 1.2rem; font-weight: 600; color: var(--story-primary); }
    .org-role-note { color: var(--story-text-muted); font-size: 0.82rem; }
    .org-meta { margin: 0.5rem 0 0 0.3rem; color: var(--story-text-muted); font-size: 0.86rem; }
    .actions-row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.8rem; margin-left: 0.3rem; }
    form { display: flex; flex-direction: column; gap: 0.65rem; }
    label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.9rem; color: var(--story-text); }
    input, select { padding: 0.45rem 0.55rem; border: 1px solid var(--story-border-strong); border-radius: 6px; background: var(--story-surface); color: var(--story-text); }
    input:focus-visible, select:focus-visible { outline: 2px solid var(--story-focus-ring); outline-offset: 1px; }
    .btn { width: fit-content; padding: 0.45rem 0.85rem; border: 1px solid transparent; border-radius: 6px; background: var(--story-primary); color: var(--story-on-primary); cursor: pointer; font-size: 0.78rem; transition: background 0.18s ease; }
    .btn:hover:not(:disabled) { background: var(--story-primary-hover); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline { background: var(--story-surface); border-color: var(--story-border-strong); color: var(--story-text); }
    .btn-outline:hover:not(:disabled) { border-color: var(--story-primary); color: var(--story-primary); background: var(--story-bg-page); }
    .btn-danger { background: var(--story-danger); color: var(--story-on-primary); }
    .btn-danger:hover:not(:disabled) { filter: brightness(1.08); }
    .alert { margin: 0 0 0.75rem; font-size: 0.9rem; }
    .error { color: var(--story-danger); }
    .success { color: var(--story-success); }
    .empty-state { text-align: center; padding: 2rem; border: 1px dashed var(--story-border-strong); border-radius: 8px; background: var(--story-bg-page); }
    .empty-state-text { color: var(--story-text-muted); margin-bottom: 1rem; font-size: 0.95rem; }
    .empty-state-second-btn { margin-left: 0.5rem; }
    .btn-icon { width: 1.1rem; height: 1.1rem; margin-right: 0.4rem; vertical-align: text-bottom; display: inline-block; }
    .btn-primary { background: var(--story-accent); color: #1c1917; border: 1px solid var(--story-accent); font-weight: 600; }
    .btn-primary:hover:not(:disabled) { background: var(--story-accent-muted); border-color: var(--story-accent-muted); }
    .modal { border: none; border-radius: 10px; width: min(100%, 530px); padding: 0; }
    .modal::backdrop { background: rgb(15 23 42 / 0.45); }
    .modal-inner { padding: 1rem 1.15rem; background: var(--story-surface); color: var(--story-text); border-radius: 10px; }
    .modal-title { margin: 0; font-size: 1.03rem; font-weight: 600; color: var(--story-text); }
    .modal-subtitle { margin: 0.35rem 0 0.8rem; color: var(--story-text-muted); font-size: 0.85rem; }
    .accent { color: var(--story-accent-muted); font-weight: 600; }
    .members-list { border: 1px solid var(--story-border); border-radius: 8px; max-height: 300px; overflow: auto; padding: 0.7rem; margin: 0.4rem 0 0.8rem; background: var(--story-bg-page); }
    .members-list ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.65rem; }
    .members-list li { font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; }
    .meta { color: var(--story-text-muted); font-size: 0.75rem; margin-left: 0.35rem; }
    .meta-you { color: var(--story-secondary); font-size: 0.75rem; margin-left: 0.35rem; font-weight: 600; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
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
