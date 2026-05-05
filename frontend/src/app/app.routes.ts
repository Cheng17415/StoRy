import { Routes } from '@angular/router';

import { authGuard, landingGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [landingGuard],
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'categorias',
    loadComponent: () =>
      import('./features/catalogo/categorias.component').then((m) => m.CategoriasComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./features/auth/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'productos',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/catalogo/productos.component').then((m) => m.ProductosComponent),
  },
  {
    path: 'producto/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/catalogo/producto-detalle.component').then((m) => m.ProductoDetalleComponent),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/perfil/perfil.component').then((m) => m.PerfilComponent),
  },
  {
    path: 'empresa',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/company/company.component').then((m) => m.CompanyComponent),
  },
  { path: '**', redirectTo: '' },
];
