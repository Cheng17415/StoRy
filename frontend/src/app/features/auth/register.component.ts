import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GoogleAuthConfigService } from '../../core/services/google-auth-config.service';
import { GoogleSignInButtonComponent } from './google-sign-in-button.component';

@Component({
  selector: 'app-register',
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
          <h2>Empieza en dos minutos.</h2>
          <p>Crea tu cuenta y prepara tu primer espacio de inventario en cuestión de clics.</p>

          <ul class="brand-bullets">
            <li>
              <span class="check">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" /></svg>
              </span>
              Sin tarjeta de crédito
            </li>
            <li>
              <span class="check">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" /></svg>
              </span>
              Multi-empresa con roles
            </li>
            <li>
              <span class="check">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" d="M20 6 9 17l-5-5" /></svg>
              </span>
              Acceso con Google en un clic
            </li>
          </ul>
        </div>

        <div class="brand-mini">
          <div class="mini-header">
            <div class="mini-dots"><span></span><span></span><span></span></div>
            <div class="mini-title">Tu primer producto</div>
          </div>
          <div class="mini-body">
            <div class="mini-row">
              <span class="mini-thumb"></span>
              <div class="mini-text">
                <span class="mini-name">Producto nuevo</span>
                <span class="mini-meta">Sin categoría - 0 uds.</span>
              </div>
              <span class="mini-pill">Nuevo</span>
            </div>
            <div class="mini-progress" aria-hidden="true">
              <span class="mini-step done"></span>
              <span class="mini-step done"></span>
              <span class="mini-step active"></span>
              <span class="mini-step"></span>
            </div>
          </div>
        </div>
      </aside>

      <section class="auth-card" aria-labelledby="register-title">
        <header class="auth-head">
          <h1 id="register-title">Crear cuenta</h1>
          <p class="auth-sub">Configura tu acceso a StoRy en menos de un minuto.</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()" class="auth-form">
          <label class="field">
            <span class="field-label">Nombre</span>
            <span class="field-input">
              <svg class="field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </svg>
              <input type="text" formControlName="name" autocomplete="name" placeholder="Tu nombre" />
            </span>
          </label>

          <label class="field">
            <span class="field-label">Email</span>
            <span class="field-input">
              <svg class="field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v12H4zM4 6l8 7 8-7" />
              </svg>
              <input type="email" formControlName="email" autocomplete="email" placeholder="tu@email.com" />
            </span>
          </label>

          <label class="field">
            <span class="field-label">Usuario</span>
            <span class="field-input">
              <svg class="field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 4l16 16M4 20 20 4" />
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 12h16" />
              </svg>
              <input type="text" formControlName="username" autocomplete="username" placeholder="mi-usuario" />
            </span>
          </label>

          <label class="field">
            <span class="field-label">Contraseña <span class="hint"> - mín. 8 caracteres</span></span>
            <span class="field-input">
              <svg class="field-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4" />
              </svg>
              <input type="password" formControlName="password" autocomplete="new-password" placeholder="••••••••" />
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
              Creando cuenta…
            } @else {
              Crear cuenta
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
          ¿Ya tienes cuenta? <a routerLink="/login">Iniciar sesión</a>
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
        radial-gradient(600px 220px at 10% 0%, rgba(245, 158, 11, 0.4), transparent 60%),
        radial-gradient(500px 220px at 100% 100%, rgba(59, 130, 246, 0.45), transparent 60%),
        linear-gradient(160deg, #1e40af 0%, #4338ca 55%, #6d28d9 100%);
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      min-height: 30rem;
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
      background: rgba(251, 191, 36, 0.55);
      top: -60px;
      left: -40px;
    }

    .brand-glow-2 {
      width: 180px;
      height: 180px;
      background: rgba(96, 165, 250, 0.55);
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

    .mini-body {
      padding: 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .mini-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding: 0.5rem 0.6rem;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .mini-thumb {
      width: 32px;
      height: 32px;
      border-radius: 7px;
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      flex: 0 0 auto;
    }

    .mini-text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .mini-name {
      font-size: 0.82rem;
      font-weight: 600;
      color: #ffffff;
    }

    .mini-meta {
      font-size: 0.7rem;
      color: rgba(248, 250, 252, 0.65);
    }

    .mini-pill {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 0.15rem 0.45rem;
      border-radius: 999px;
      background: rgba(74, 222, 128, 0.2);
      color: #86efac;
    }

    .mini-progress {
      display: flex;
      gap: 5px;
    }

    .mini-step {
      flex: 1;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.15);
      transition: background 0.3s ease;
    }

    .mini-step.done {
      background: #4ade80;
    }

    .mini-step.active {
      background: #fbbf24;
      animation: pulseStep 1.5s ease-in-out infinite;
    }

    @keyframes pulseStep {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
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

    .field-label .hint {
      color: #94a3b8;
      font-weight: 500;
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
      .mini-step,
      .spinner {
        animation: none !important;
      }
    }
  `,
})
export class RegisterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly googleAuthConfig = inject(GoogleAuthConfigService);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
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
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => void this.router.navigateByUrl('/empresa'),
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Error al registrarse';
        this.error.set(typeof msg === 'string' ? msg : 'Error al registrarse');
      },
      complete: () => this.loading.set(false),
    });
  }

  protected onGoogleCredential(credential: string): void {
    this.error.set('');
    this.loading.set(true);
    this.auth.loginWithGoogle(credential).subscribe({
      next: () => void this.router.navigateByUrl('/empresa'),
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Error con Google';
        this.error.set(typeof msg === 'string' ? msg : 'Error con Google');
      },
      complete: () => this.loading.set(false),
    });
  }
}
