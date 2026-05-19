import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import type { AuthResponse, AuthUserDto, LoginPayload, RegisterPayload } from '../models/auth.models';

const TOKEN_KEY = 'story_access_token';
const USER_KEY = 'story_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly token = signal<string | null>(this.readToken());
  private readonly user = signal<AuthUserDto | null>(this.readUser());

  readonly loggedIn = computed(() => {
    const t = this.token()?.trim();
    return t != null && t.length > 0;
  });
  readonly currentUser = computed(() => this.user());
  readonly inCompany = computed(() => this.currentUser()?.companyId != null);

  defaultHomeRoute(): string {
    return this.inCompany() ? '/productos' : '/empresa';
  }

  resolvePostAuthUrl(returnUrl: string | null | undefined): string {
    const fallback = this.defaultHomeRoute();
    if (!returnUrl?.startsWith('/')) {
      return fallback;
    }
    if (this.routeRequiresCompany(returnUrl) && !this.inCompany()) {
      return '/empresa';
    }
    return returnUrl;
  }

  routeRequiresCompany(url: string): boolean {
    if (url.startsWith('/producto/')) {
      return true;
    }
    const paths = ['/productos', '/estadisticas', '/stock-bajo', '/categorias'];
    return paths.some((p) => url === p || url.startsWith(`${p}/`));
  }

  getToken(): string | null {
    const norm = (raw: string | null): string | null => {
      if (raw == null) {
        return null;
      }
      const t = raw.trim();
      return t.length > 0 ? t : null;
    };
    const cached = norm(this.token());
    if (cached) {
      return cached;
    }
    const fromStorage = norm(sessionStorage.getItem(TOKEN_KEY));
    if (fromStorage) {
      this.token.set(fromStorage);
      return fromStorage;
    }
    return null;
  }

  /** Actualiza el usuario en memoria y sessionStorage (p. ej. tras editar perfil). */
  updateStoredUser(user: AuthUserDto): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', payload).pipe(tap((r) => this.persist(r)));
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', payload).pipe(tap((r) => this.persist(r)));
  }

  loginWithGoogle(idToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/google', { idToken }).pipe(tap((r) => this.persist(r)));
  }

  private persist(r: AuthResponse): void {
    const access = r.accessToken?.trim() ?? '';
    sessionStorage.setItem(TOKEN_KEY, access);
    sessionStorage.setItem(USER_KEY, JSON.stringify(r.user));
    this.token.set(access.length > 0 ? access : null);
    this.user.set(r.user);
  }

  private readToken(): string | null {
    const raw = sessionStorage.getItem(TOKEN_KEY)?.trim();
    return raw && raw.length > 0 ? raw : null;
  }

  private readUser(): AuthUserDto | null {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      const u = JSON.parse(raw) as AuthUserDto;
      return {
        ...u,
        googleConnected: u.googleConnected ?? false,
        companyId: u.companyId ?? null,
        companyName: u.companyName ?? null,
        companyCurrency: u.companyCurrency ?? null,
        companyRole: u.companyRole ?? null,
      };
    } catch {
      return null;
    }
  }
}
