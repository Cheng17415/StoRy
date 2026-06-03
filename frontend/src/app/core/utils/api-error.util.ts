import { HttpErrorResponse } from '@angular/common/http';

/** Mensaje de error de la API Spring (`ApiError.message`) con fallback. */
export function extractApiError(err: unknown, fallback = 'No se pudo completar la operación.'): string {
  if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object') {
    const body = err.error as { message?: string };
    if (typeof body.message === 'string' && body.message.length > 0) {
      return body.message;
    }
  }
  if (err && typeof err === 'object' && 'error' in err) {
    const nested = (err as { error?: { message?: string }; message?: string }).error?.message;
    if (typeof nested === 'string' && nested.length > 0) {
      return nested;
    }
    const direct = (err as { message?: string }).message;
    if (typeof direct === 'string' && direct.length > 0) {
      return direct;
    }
  }
  return fallback;
}
