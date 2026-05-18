import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GoogleAuthConfigService } from '../../core/services/google-auth-config.service';
import { GoogleSignInButtonComponent } from './google-sign-in-button.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, GoogleSignInButtonComponent],
  template: `
    <div class="auth-shell">
      <aside class="brand-panel" aria-hidden="true">
        <div class="brand-glow brand-glow-1"></div>
        <div class="brand-glow brand-glow-2"></div>

        <div class="brand-top">
          <span class="brand-logo">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
            </svg>
            StoRy
          </span>
        </div>

        <div class="brand-message">
          <h2>Bienvenido de vuelta.</h2>
          <p>Tu inventario te está esperando, ordenado y sin caos.</p>

          <ul class="brand-bullets">
            <li>
              <span class="check">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" /></svg>
              </span>
              Productos y carpetas a un clic
            </li>
            <li>
              <span class="check">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" /></svg>
              </span>
              Movimientos trazados al segundo
            </li>
            <li>
              <span class="check">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" /></svg>
              </span>
              Estadísticas listas para revisar
            </li>
          </ul>
        </div>

        <div class="brand-mini">
          <div class="mini-header">
            <div class="mini-dots"><span></span><span></span><span></span></div>
            <div class="mini-title">Movimientos · hoy</div>
          </div>
          <div class="mini-chart">
            <div class="bar" style="--h: 30%"></div>
            <div class="bar" style="--h: 55%"></div>
            <div class="bar" style="--h: 42%"></div>
            <div class="bar accent" style="--h: 88%"></div>
            <div class="bar" style="--h: 60%"></div>
            <div class="bar" style="--h: 72%"></div>
          </div>
        </div>
      </aside>

      <section class="auth-card" aria-labelledby="login-title">
        <header class="auth-head">
          <h1 id="login-title">Iniciar sesión</h1>
          <p class="auth-sub">Accede a tu espacio de trabajo de StoRy.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
          <label class="field">
            <span class="field-label">Usuario o email</span>
            <span class="field-input">
              <svg class="field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
              <input type="text" formControlName="usernameOrEmail" autocomplete="username" placeholder="usuario@empresa.com" />
            </span>
          </label>

          <label class="field">
            <span class="field-label">Contraseña</span>
            <span class="field-input">
              <svg class="field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4" />
              </svg>
              <input type="password" formControlName="password" autocomplete="current-password" placeholder="••••••••" />
            </span>
          </label>

          @if (error()) {
            <p class="error" role="alert">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              {{ error() }}
            </p>
          }

          <button type="submit" class="btn-primary" [disabled]="form.invalid || loading()">
            @if (loading()) {
              <span class="spinner" aria-hidden="true"></span>
              Entrando…
            } @else {
              Entrar
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            }
          </button>
        </form>

        @if (googleClientId()) {
          <div class="divider"><span>o</span></div>
          <div class="google-wrap">
            <app-google-sign-in-button
              [clientId]="googleClientId()"
              (signedIn)="onGoogleCredential($event)"
            />
          </div>
        }

        <p class="auth-foot">
          ¿No tienes cuenta? <a routerLink="/register">Crear cuenta</a>
        </p>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .auth-shell {
      max-width: 62rem;
      margin: 1.5rem auto 2rem;
      padding: 0 1rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: stretch;
    }

    /* ---------- BRAND PANEL ---------- */
    .brand-panel {
      position: relative;
      overflow: hidden;
      padding: 1.75rem 1.6rem;
      border-radius: 20px;
      border: 1px solid var(--story-border);
      background:
        radial-gradient(600px 220px at 10% 0%, rgba(59, 130, 246, 0.45), transparent 60%),
        radial-gradient(500px 220px at 100% 100%, rgba(245, 158, 11, 0.35), transparent 60%),
        linear-gradient(160deg, #1e3a8a 0%, #1e40af 55%, #312e81 100%);
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      min-height: 28rem;
    }

    .brand-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(50px);
      opacity: 0.55;
      pointer-events: none;
    }

    .brand-glow-1 {
      width: 220px;
      height: 220px;
      background: rgba(96, 165, 250, 0.55);
      top: -60px;
      left: -40px;
    }

    .brand-glow-2 {
      width: 180px;
      height: 180px;
      background: rgba(251, 191, 36, 0.45);
      bottom: -50px;
      right: -30px;
    }

    .brand-top {
      position: relative;
      z-index: 1;
    }

    .brand-logo {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      font-size: 1.05rem;
      color: #ffffff;
    }

    .brand-logo svg {
      color: #fbbf24;
    }

    .brand-message {
      position: relative;
      z-index: 1;
      margin-top: auto;
    }

    .brand-message h2 {
      margin: 0 0 0.5rem;
      font-size: clamp(1.5rem, 2.2vw, 1.85rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
      color: #ffffff;
    }

    .brand-message p {
      margin: 0 0 1.1rem;
      color: rgba(248, 250, 252, 0.85);
      font-size: 0.95rem;
      line-height: 1.5;
      max-width: 22rem;
    }

    .brand-bullets {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }

    .brand-bullets li {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.9rem;
      color: rgba(248, 250, 252, 0.92);
    }

    .check {
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.22);
      color: #4ade80;
      flex: 0 0 auto;
    }

    .brand-mini {
      position: relative;
      z-index: 1;
      margin-top: auto;
      background: rgba(15, 23, 42, 0.35);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      backdrop-filter: blur(6px);
      overflow: hidden;
    }

    .mini-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .mini-dots {
      display: flex;
      gap: 4px;
    }

    .mini-dots span {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
    }

    .mini-dots span:nth-child(1) { background: #ef4444; }
    .mini-dots span:nth-child(2) { background: #f59e0b; }
    .mini-dots span:nth-child(3) { background: #22c55e; }

    .mini-title {
      font-size: 0.72rem;
      color: rgba(248, 250, 252, 0.75);
      font-weight: 600;
    }

    .mini-chart {
      display: flex;
      align-items: flex-end;
      gap: 5px;
      height: 60px;
      padding: 0.5rem 0.6rem;
    }

    .mini-chart .bar {
      flex: 1;
      height: var(--h);
      background: linear-gradient(180deg, rgba(147, 197, 253, 0.95) 0%, rgba(96, 165, 250, 0.7) 100%);
      border-radius: 3px 3px 1px 1px;
      animation: barGrow 1.2s ease-out both;
      transform-origin: bottom;
    }

    .mini-chart .bar.accent {
      background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
    }

    .mini-chart .bar:nth-child(1) { animation-delay: 0.05s; }
    .mini-chart .bar:nth-child(2) { animation-delay: 0.12s; }
    .mini-chart .bar:nth-child(3) { animation-delay: 0.19s; }
    .mini-chart .bar:nth-child(4) { animation-delay: 0.26s; }
    .mini-chart .bar:nth-child(5) { animation-delay: 0.33s; }
    .mini-chart .bar:nth-child(6) { animation-delay: 0.40s; }

    @keyframes barGrow {
      from { transform: scaleY(0); opacity: 0; }
      to { transform: scaleY(1); opacity: 1; }
    }

    /* ---------- AUTH CARD ---------- */
    .auth-card {
      padding: 2rem 1.85rem;
      background: #ffffff;
      border: 1px solid var(--story-border);
      border-radius: 20px;
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);
      display: flex;
      flex-direction: column;
    }

    .auth-head {
      margin-bottom: 1.25rem;
    }

    .auth-head h1 {
      margin: 0 0 0.35rem;
      font-size: 1.55rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: #0f172a;
    }

    .auth-sub {
      margin: 0;
      color: #475569;
      font-size: 0.92rem;
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .field-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #334155;
    }

    .field-input {
      position: relative;
      display: flex;
      align-items: center;
    }

    .field-icon {
      position: absolute;
      left: 0.7rem;
      color: #94a3b8;
      pointer-events: none;
    }

    .field-input input {
      flex: 1;
      width: 100%;
      padding: 0.65rem 0.85rem 0.65rem 2.3rem;
      font-size: 0.95rem;
      border: 1px solid var(--story-border-strong);
      border-radius: 10px;
      background: #ffffff;
      color: #0f172a;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .field-input input::placeholder {
      color: #94a3b8;
    }

    .field-input input:hover {
      border-color: #94a3b8;
    }

    .field-input input:focus {
      outline: none;
      border-color: var(--story-primary);
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .field-input:focus-within .field-icon {
      color: var(--story-primary);
    }

    .btn-primary {
      margin-top: 0.4rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.45rem;
      padding: 0.75rem 1.1rem;
      border-radius: 10px;
      font-size: 0.95rem;
      font-weight: 600;
      color: #ffffff;
      background: var(--story-primary);
      border: 1px solid var(--story-primary);
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(30, 64, 175, 0.28);
      transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.05s ease;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--story-primary-hover);
      border-color: var(--story-primary-hover);
      box-shadow: 0 8px 22px rgba(30, 64, 175, 0.34);
    }

    .btn-primary:active:not(:disabled) {
      transform: translateY(1px);
    }

    .btn-primary:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px var(--story-focus-ring);
    }

    .btn-primary:disabled {
      opacity: 0.6;
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

    .error {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin: 0;
      padding: 0.55rem 0.7rem;
      font-size: 0.85rem;
      color: var(--story-danger);
      background: rgba(185, 28, 28, 0.07);
      border: 1px solid rgba(185, 28, 28, 0.2);
      border-radius: 8px;
    }

    .divider {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 1.25rem 0 1rem;
      color: #94a3b8;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--story-border);
    }

    .google-wrap {
      display: flex;
      justify-content: center;
    }

    .auth-foot {
      margin: 1.4rem 0 0;
      text-align: center;
      font-size: 0.9rem;
      color: #475569;
    }

    .auth-foot a {
      color: var(--story-primary);
      font-weight: 600;
      text-decoration: none;
    }

    .auth-foot a:hover {
      color: var(--story-primary-hover);
      text-decoration: underline;
    }

    /* ---------- RESPONSIVE ---------- */
    @media (max-width: 860px) {
      .auth-shell {
        grid-template-columns: 1fr;
      }

      .brand-panel {
        min-height: 0;
        padding: 1.4rem 1.4rem 1.5rem;
      }

      .brand-mini {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mini-chart .bar,
      .spinner {
        animation: none !important;
      }
    }
  `,
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly googleAuthConfig = inject(GoogleAuthConfigService);

  protected readonly form = this.fb.nonNullable.group({
    usernameOrEmail: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly googleClientId = signal('');

  ngOnInit(): void {
    this.googleAuthConfig.getClientId().subscribe({
      next: (id) => this.googleClientId.set(id),
      error: () => this.googleClientId.set(''),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Error al iniciar sesión';
        this.error.set(typeof msg === 'string' ? msg : 'Error al iniciar sesión');
      },
      complete: () => this.loading.set(false),
    });
  }

  protected onGoogleCredential(credential: string): void {
    this.error.set('');
    this.loading.set(true);
    this.auth.loginWithGoogle(credential).subscribe({
      next: () => this.navigateAfterLogin(),
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Error con Google';
        this.error.set(typeof msg === 'string' ? msg : 'Error con Google');
      },
      complete: () => this.loading.set(false),
    });
  }

  private navigateAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    void this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/productos');
  }
}
