import { HttpErrorResponse } from '@angular/common/http';

export function mensajeDeError(error: unknown, porDefecto: string): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = error.error as { message?: unknown } | null;
    const mensaje = cuerpo?.message;

    if (typeof mensaje === 'string' && mensaje.trim()) {
      return mensaje;
    }

    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
  }

  return porDefecto;
}
