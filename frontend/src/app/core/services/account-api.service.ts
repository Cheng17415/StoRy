import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type { AuthUserDto } from '../models/auth.models';

export interface UpdateProfilePayload {
  name: string;
  email: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly http = inject(HttpClient);

  getProfile(): Observable<AuthUserDto> {
    return this.http.get<AuthUserDto>('/api/account/me');
  }

  updateProfile(payload: UpdateProfilePayload): Observable<AuthUserDto> {
    return this.http.patch<AuthUserDto>('/api/account/me', payload);
  }

  changePassword(payload: ChangePasswordPayload): Observable<void> {
    return this.http.put<void>('/api/account/password', payload);
  }

  linkGoogle(idToken: string): Observable<AuthUserDto> {
    return this.http.post<AuthUserDto>('/api/account/link-google', { idToken });
  }

  unlinkGoogle(): Observable<AuthUserDto> {
    return this.http.post<AuthUserDto>('/api/account/unlink-google', {});
  }
}
