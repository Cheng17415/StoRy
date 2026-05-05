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

  readonly loggedIn = computed(() => this.token() !== null && this.token()!.length > 0);
  readonly currentUser = computed(() => this.user());

  getToken(): string | null {
    return this.token();
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
    sessionStorage.setItem(TOKEN_KEY, r.accessToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(r.user));
    this.token.set(r.accessToken);
    this.user.set(r.user);
  }

  private readToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
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
