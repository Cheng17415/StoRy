import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { take } from 'rxjs/operators';
import { AccountApiService } from '../../core/services/account-api.service';
import { AuthService } from '../../core/services/auth.service';
import { GoogleAuthConfigService } from '../../core/services/google-auth-config.service';
import { extractApiError } from '../../core/utils/api-error.util';
import { GoogleSignInButtonComponent } from '../auth/google-sign-in-button.component';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [ReactiveFormsModule, GoogleSignInButtonComponent],
  template: `
    <div class="perfil-page">
      <h1 class="perfil-title">Perfil de usuario</h1>

      @if (loadError()) {
        <p class="perfil-banner perfil-banner--error" role="alert">{{ loadError() }}</p>
      }

      @if (loading()) {
        <p class="perfil-loading">Cargando…</p>
      } @else if (!loadError()) {
        <form class="perfil-card" (ngSubmit)="onSaveProfile()" [formGroup]="profileForm">
          <h2 class="perfil-card-title">Información personal</h2>
          <div class="perfil-grid">
            <label class="perfil-field">
              <span class="perfil-label">Nombre</span>
              <input type="text" formControlName="name" autocomplete="name" />
            </label>
            <label class="perfil-field">
              <span class="perfil-label">Correo electrónico</span>
              <input type="email" formControlName="email" autocomplete="email" />
            </label>
            <label class="perfil-field perfil-field--full">
              <span class="perfil-label">Usuario</span>
              <input type="text" formControlName="username" readonly class="perfil-input-readonly" />
            </label>
          </div>
          @if (profileFeedback()) {
            <p
              class="perfil-banner"
              [class.perfil-banner--error]="profileFeedback()!.kind === 'error'"
              [class.perfil-banner--ok]="profileFeedback()!.kind === 'ok'"
            >
              {{ profileFeedback()!.text }}
            </p>
          }
          <div class="perfil-actions">
            <button
              type="submit"
              class="perfil-btn-save"
              [disabled]="profileForm.invalid || savingProfile()"
            >
              Guardar cambios
            </button>
          </div>
        </form>

        @if (isLocalAccount()) {
          <form class="perfil-card" (ngSubmit)="onChangePassword()" [formGroup]="passwordForm">
            <h2 class="perfil-card-title">Cambiar contraseña</h2>
            <div class="perfil-grid">
              <label class="perfil-field">
                <span class="perfil-label">Contraseña actual</span>
                <input
                  type="password"
                  formControlName="currentPassword"
                  autocomplete="current-password"
                />
              </label>
              <label class="perfil-field">
                <span class="perfil-label">Nueva contraseña</span>
                <input type="password" formControlName="newPassword" autocomplete="new-password" />
              </label>
            </div>
            @if (passwordFeedback()) {
              <p
                class="perfil-banner"
                [class.perfil-banner--error]="passwordFeedback()!.kind === 'error'"
                [class.perfil-banner--ok]="passwordFeedback()!.kind === 'ok'"
              >
                {{ passwordFeedback()!.text }}
              </p>
            }
            <div class="perfil-actions perfil-actions--split">
              <button
                type="submit"
                class="perfil-btn-save"
                [disabled]="passwordForm.invalid || savingPassword()"
              >
                Guardar cambios
              </button>
              <span class="perfil-hint" title="Función no disponible aún">¿Olvidaste tu contraseña?</span>
            </div>
          </form>
        }

        <section class="perfil-card">
          <h2 class="perfil-card-title">Cuentas vinculadas</h2>
          @if (linkFeedback()) {
            <p
              class="perfil-banner"
              [class.perfil-banner--error]="linkFeedback()!.kind === 'error'"
              [class.perfil-banner--ok]="linkFeedback()!.kind === 'ok'"
            >
              {{ linkFeedback()!.text }}
            </p>
          }
          <ul class="perfil-linked-list">
            <li class="perfil-linked-row perfil-linked-row--google">
              <span class="perfil-linked-brand" aria-hidden="true">
                <svg class="perfil-google-icon" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </span>
              <div class="perfil-linked-text">
                <span class="perfil-linked-name">Google</span>
                @if (googleConnected()) {
                  <span class="perfil-linked-detail">{{ email() }}</span>
                } @else {
                  <span class="perfil-linked-detail muted">No conectado</span>
                }
              </div>
              <div class="perfil-linked-actions">
                @if (!googleConnected() && isLocalAccount()) {
                  @if (googleClientIdForLink()) {
                    <div class="perfil-google-btn-wrap">
                      <app-google-sign-in-button
                        [clientId]="googleClientIdForLink()!"
                        (signedIn)="onLinkGoogle($event)"
                      />
                    </div>
                  } @else {
                    <span class="perfil-mini-hint">Define GOOGLE_CLIENT_ID en el backend para usar el botón.</span>
                  }
                } @else if (googleConnected() && canUnlinkGoogle()) {
                  <button
                    type="button"
                    class="perfil-link-action perfil-link-action--active"
                    [disabled]="linkBusy()"
                    (click)="onUnlinkGoogle()"
                  >
                    Desvincular
                  </button>
                } @else if (googleConnected()) {
                  <button
                    type="button"
                    class="perfil-link-action"
                    disabled
                    title="Las cuentas que solo usan Google no se pueden desvincular aquí"
                  >
                    Desvincular
                  </button>
                }
              </div>
            </li>
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    .perfil-page {
      max-width: 52rem;
      margin: 0 auto;
    }

    .perfil-title {
      margin: 0 0 1.5rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: #202124;
    }

    .perfil-loading {
      color: #5f6368;
      margin: 0;
    }

    .perfil-card {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 1px 2px rgba(60, 64, 67, 0.1), 0 2px 8px rgba(60, 64, 67, 0.08);
      padding: 1.5rem 1.75rem 1.75rem;
      margin-bottom: 1.25rem;
    }

    .perfil-card-title {
      margin: 0 0 1.25rem;
      font-size: 1rem;
      font-weight: 600;
      color: #202124;
    }

    .perfil-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem 1.25rem;
    }

    @media (max-width: 640px) {
      .perfil-grid {
        grid-template-columns: 1fr;
      }
    }

    .perfil-field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      min-width: 0;
    }

    .perfil-field--full {
      grid-column: 1 / -1;
    }

    .perfil-label {
      font-size: 0.75rem;
      font-weight: 500;
      color: #5f6368;
    }

    .perfil-field input {
      width: 100%;
      padding: 0.55rem 0.75rem;
      font: inherit;
      font-size: 0.95rem;
      color: #202124;
      border: 1px solid #dadce0;
      border-radius: 8px;
      background: #fff;
    }

    .perfil-field input:focus {
      outline: none;
      border-color: var(--story-primary);
      box-shadow: 0 0 0 1px var(--story-primary);
    }

    .perfil-input-readonly {
      background: #f8f9fa !important;
      color: #5f6368;
    }

    .perfil-actions {
      margin-top: 1.25rem;
    }

    .perfil-actions--split {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .perfil-btn-save {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.55rem 1.1rem;
      font: inherit;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #5f6368;
      background: #fff;
      border: 1px solid #dadce0;
      border-radius: 6px;
      cursor: pointer;
      transition:
        background 0.15s ease,
        border-color 0.15s ease;
    }

    .perfil-btn-save:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #bdc1c6;
    }

    .perfil-btn-save:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .perfil-hint {
      font-size: 0.85rem;
      color: #80868b;
      cursor: default;
    }

    .perfil-banner {
      margin: 0.75rem 0 0;
      padding: 0.5rem 0.65rem;
      font-size: 0.88rem;
      border-radius: 8px;
    }

    .perfil-banner--ok {
      background: #e6f4ea;
      color: #137333;
    }

    .perfil-banner--error {
      background: #fce8e6;
      color: #c5221f;
    }

    .perfil-linked-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .perfil-linked-row {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 0;
      border-bottom: 1px solid #f1f3f4;
    }

    .perfil-linked-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .perfil-linked-row:first-child {
      padding-top: 0;
    }

    .perfil-linked-brand {
      flex-shrink: 0;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .perfil-google-icon {
      width: 22px;
      height: 22px;
      display: block;
    }

    .perfil-linked-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .perfil-linked-name {
      font-weight: 600;
      font-size: 0.95rem;
      color: #202124;
    }

    .perfil-linked-detail {
      font-size: 0.85rem;
      color: #5f6368;
      word-break: break-all;
    }

    .perfil-linked-detail.muted {
      color: #80868b;
    }

    .perfil-link-action {
      flex-shrink: 0;
      padding: 0;
      border: none;
      background: none;
      font: inherit;
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--story-primary);
      cursor: not-allowed;
      opacity: 0.65;
    }

    .perfil-link-action--active {
      cursor: pointer;
      opacity: 1;
    }

    .perfil-link-action--active:hover:not(:disabled) {
      text-decoration: underline;
    }

    .perfil-link-action--active:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      text-decoration: none;
    }

    .perfil-linked-actions {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.35rem;
      max-width: 100%;
    }

    .perfil-google-btn-wrap {
      display: flex;
      justify-content: flex-end;
    }

    .perfil-mini-hint {
      font-size: 0.78rem;
      color: #80868b;
      max-width: 12rem;
      text-align: right;
      line-height: 1.35;
    }

    .perfil-linked-row--google {
      align-items: flex-start;
    }

    @media (max-width: 640px) {
      .perfil-linked-actions {
        align-items: stretch;
      }
      .perfil-mini-hint {
        text-align: left;
        max-width: none;
      }
    }
  `,
})
export class PerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly account = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly googleAuthConfig = inject(GoogleAuthConfigService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly provider = signal<string | null>(null);
  protected readonly email = signal('');
  protected readonly googleConnected = signal(false);
  protected readonly googleClientIdForLink = signal('');
  protected readonly linkBusy = signal(false);
  protected readonly profileFeedback = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  protected readonly passwordFeedback = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);
  protected readonly linkFeedback = signal<{ kind: 'ok' | 'error'; text: string } | null>(null);

  protected readonly isLocalAccount = computed(() => this.provider() === 'LOCAL');

  protected readonly canUnlinkGoogle = computed(
    () => this.provider() === 'LOCAL' && this.googleConnected(),
  );

  protected readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    username: [{ value: '', disabled: true }],
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  ngOnInit(): void {
    forkJoin({
      profile: this.account.getProfile(),
      googleClientId: this.googleAuthConfig.getClientId().pipe(take(1)),
    }).subscribe({
      next: ({ profile, googleClientId }) => {
        this.auth.updateStoredUser(profile);
        this.provider.set(profile.provider);
        this.email.set(profile.email);
        this.googleConnected.set(profile.googleConnected ?? false);
        this.googleClientIdForLink.set(googleClientId);
        this.profileForm.patchValue({
          name: profile.name,
          email: profile.email,
          username: profile.username,
        });
        this.loading.set(false);
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.auth.logout();
          void this.router.navigate(['/login'], { queryParams: { returnUrl: '/perfil' } });
          this.loading.set(false);
          return;
        }
        this.loadError.set(extractApiError(err));
        this.loading.set(false);
      },
    });
  }

  protected onSaveProfile(): void {
    if (this.profileForm.invalid) return;
    this.profileFeedback.set(null);
    this.savingProfile.set(true);
    const { name, email } = this.profileForm.getRawValue();
    this.account.updateProfile({ name, email }).subscribe({
      next: (u) => {
        this.auth.updateStoredUser(u);
        this.email.set(u.email);
        this.googleConnected.set(u.googleConnected ?? false);
        this.profileFeedback.set({ kind: 'ok', text: 'Cambios guardados.' });
        this.savingProfile.set(false);
      },
      error: (err: unknown) => {
        this.profileFeedback.set({ kind: 'error', text: extractApiError(err) });
        this.savingProfile.set(false);
      },
    });
  }

  protected onChangePassword(): void {
    if (this.passwordForm.invalid) return;
    this.passwordFeedback.set(null);
    this.savingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.account.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.passwordFeedback.set({ kind: 'ok', text: 'Contraseña actualizada.' });
        this.passwordForm.reset();
        this.savingPassword.set(false);
      },
      error: (err: unknown) => {
        this.passwordFeedback.set({ kind: 'error', text: extractApiError(err) });
        this.savingPassword.set(false);
      },
    });
  }

  protected onLinkGoogle(idToken: string): void {
    this.linkFeedback.set(null);
    this.linkBusy.set(true);
    this.account.linkGoogle(idToken).subscribe({
      next: (u) => {
        this.auth.updateStoredUser(u);
        this.googleConnected.set(u.googleConnected ?? false);
        this.provider.set(u.provider);
        this.email.set(u.email);
        this.linkFeedback.set({ kind: 'ok', text: 'Cuenta de Google vinculada. Ya puedes iniciar sesión con Google.' });
        this.linkBusy.set(false);
      },
      error: (err: unknown) => {
        this.linkFeedback.set({ kind: 'error', text: extractApiError(err) });
        this.linkBusy.set(false);
      },
    });
  }

  protected onUnlinkGoogle(): void {
    this.linkFeedback.set(null);
    this.linkBusy.set(true);
    this.account.unlinkGoogle().subscribe({
      next: (u) => {
        this.auth.updateStoredUser(u);
        this.googleConnected.set(u.googleConnected ?? false);
        this.linkFeedback.set({
          kind: 'ok',
          text: 'Google desvinculado. Sigue disponible el inicio de sesión con usuario y contraseña.',
        });
        this.linkBusy.set(false);
      },
      error: (err: unknown) => {
        this.linkFeedback.set({ kind: 'error', text: extractApiError(err) });
        this.linkBusy.set(false);
      },
    });
  }
}
