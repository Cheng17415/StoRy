import type { CompanyRole } from '../models/company.models';

/** Propietario de la empresa. */
export function isCompanyAdmin(role: CompanyRole | null | undefined): boolean {
  return role === 'company_admin';
}

/** Catálogo operativo (p. ej. nueva carpeta, stock): admin o empleado. */
export function canEmployeeCatalog(role: CompanyRole | null | undefined): boolean {
  return role === 'company_admin' || role === 'employee';
}

/** Edición de producto o registro de movimientos: admin o empleado. */
export function canEditProduct(role: CompanyRole | null | undefined): boolean {
  return canEmployeeCatalog(role);
}

/** Edición de datos completos del producto o stock mínimo: solo propietario. */
export function canEditFullProduct(role: CompanyRole | null | undefined): boolean {
  return isCompanyAdmin(role);
}

/** Eliminar productos: solo propietario. */
export function canDeleteProduct(role: CompanyRole | null | undefined): boolean {
  return isCompanyAdmin(role);
}

/** Estadísticas de inventario: admin o analítica (alineado con estadisticasGuard). */
export function canViewEstadisticas(role: CompanyRole | null | undefined): boolean {
  return role === 'company_admin' || role === 'analytics_viewer';
}

/** Etiqueta legible del rol en la UI. */
export function roleLabel(role: CompanyRole): string {
  switch (role) {
    case 'company_admin':
      return 'Propietario';
    case 'analytics_viewer':
      return 'Analítica';
    default:
      return 'Empleado';
  }
}
