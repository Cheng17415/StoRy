import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Pathname estable para decidir si adjuntar Bearer.
 * Usa resolución con base para cubrir URLs relativas, absolutas y protocol-relative (//host/...)
 * sin el bug de normalizar "http://" como segmentos de ruta.
 */
function requestPathname(url: string): string {
  const raw = url.trim();
  if (!raw) {
    return '';
  }
  try {
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    const pathStr = raw.startsWith('/') ? raw : `/${raw}`;
    return pathStr.split(/[?#]/)[0];
  }
}

function isPublicAuthPath(pathname: string): boolean {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

function needsBearerForPath(pathname: string): boolean {
  return pathname.startsWith('/api') && !isPublicAuthPath(pathname);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const pathname = requestPathname(req.url);
  if (token && needsBearerForPath(pathname)) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
  return next(req);
};
