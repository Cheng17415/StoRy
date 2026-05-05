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
    <div class="auth-card">
      <h1>Crear cuenta</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          Nombre
          <input type="text" formControlName="name" autocomplete="name" />
        </label>
        <label>
          Email
          <input type="email" formControlName="email" autocomplete="email" />
        </label>
        <label>
          Usuario
          <input type="text" formControlName="username" autocomplete="username" />
        </label>
        <label>
          Contraseña (mín. 8 caracteres)
          <input type="password" formControlName="password" autocomplete="new-password" />
        </label>
        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
        <button type="submit" [disabled]="form.invalid || loading()">Registrarse</button>
      </form>
      @if (googleClientId()) {
        <div class="google-wrap">
          <p class="muted">o</p>
          <app-google-sign-in-button
            [clientId]="googleClientId()"
            (signedIn)="onGoogleCredential($event)"
          />
        </div>
      }
      <p class="muted">
        ¿Ya tienes cuenta? <a routerLink="/login">Iniciar sesión</a>
      </p>
    </div>
  `,
  styles: `
    .auth-card {
      max-width: 22rem;
      margin: 2rem auto;
      padding: 1.5rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      background: #fff;
    }
    h1 {
      font-size: 1.25rem;
      margin: 0 0 1rem;
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    input {
      padding: 0.5rem 0.6rem;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    button {
      margin-top: 0.5rem;
      padding: 0.5rem 1rem;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error {
      color: #b00020;
      font-size: 0.875rem;
      margin: 0;
    }
    .muted {
      color: #555;
      font-size: 0.875rem;
      margin-top: 1rem;
    }
    a {
      color: #1a73e8;
    }
    .google-wrap {
      margin-top: 1rem;
      text-align: center;
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
      next: () => void this.router.navigateByUrl('/productos'),
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
      next: () => void this.router.navigateByUrl('/productos'),
      error: (err: { error?: { message?: string }; message?: string }) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.message ?? 'Error con Google';
        this.error.set(typeof msg === 'string' ? msg : 'Error con Google');
      },
      complete: () => this.loading.set(false),
    });
  }
}
