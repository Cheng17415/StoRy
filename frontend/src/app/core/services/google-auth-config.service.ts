import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GoogleAuthConfigService {
  private readonly http = inject(HttpClient);
  private cached$?: Observable<string>;

  /**
   * OAuth 2.0 Web Client ID for GIS. Prefer backend config; optional override in environment for local tooling.
   */
  getClientId(): Observable<string> {
    if (!this.cached$) {
      const override = environment.googleClientId?.trim();
      if (override) {
        this.cached$ = of(override);
      } else {
        this.cached$ = this.http.get<{ clientId: string }>('/api/auth/google-config').pipe(
          map((r) => (r.clientId ?? '').trim()),
          catchError(() => of('')),
          shareReplay(1),
        );
      }
    }
    return this.cached$;
  }
}
