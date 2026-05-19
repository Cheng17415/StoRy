import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.getToken()) {
    return true;
  }
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Inventario y catálogo requieren pertenecer a una empresa. */
export const companyGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.getToken()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (auth.inCompany()) {
    return true;
  }
  return router.createUrlTree(['/empresa']);
};

/** Misma API que productos (`/api/productos/estadisticas`); solo company_admin o analytics_viewer. */
export const estadisticasGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.getToken()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  if (!auth.inCompany()) {
    return router.createUrlTree(['/empresa']);
  }
  const role = auth.currentUser()?.companyRole;
  if (role === 'company_admin' || role === 'analytics_viewer') {
    return true;
  }
  return router.createUrlTree(['/productos']);
};

/** Raíz `/`: con sesión, productos si hay empresa; si no, onboarding en /empresa. */
export const landingGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.getToken()) {
    return router.createUrlTree([auth.defaultHomeRoute()]);
  }
  return true;
};
