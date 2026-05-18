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
    let pathname = new URL(raw, 'http://localhost').pathname;
    while (pathname.startsWith('//')) {
      pathname = pathname.slice(1);
    }
    return pathname;
  } catch {
    const pathStr = raw.startsWith('/') ? raw : `/${raw}`;
    return pathStr.split(/[?#]/)[0];
  }
}

function isPublicAuthPath(pathname: string): boolean {
  return pathname === '/api/auth' || pathname.startsWith('/api/auth/');
}

function needsBearerForPath(pathname: string): boolean {
  let p = pathname.trim();
  while (p.startsWith('//')) {
    p = p.slice(1);
  }
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  if (isPublicAuthPath(p)) {
    return false;
  }
  return p.startsWith('/api/') || p === '/api';
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  const pathname = requestPathname(req.url);
  if (!token || !needsBearerForPath(pathname)) {
    return next(req);
  }
  /** Siempre fijar Bearer (sobreescribe cabeceras vacías/erróneas). `headers.set` no rompe multipart/boundary. */
  return next(req.clone({ headers: req.headers.set('Authorization', `Bearer ${token}`) }));
};
