import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AutenticacionService } from './auth.service';

export const interceptorAutenticacion: HttpInterceptorFn = (peticion, siguiente) => {
  const token = inject(AutenticacionService).obtenerToken();
  const esApiPropia = peticion.url.startsWith('/');

  if (!token || !esApiPropia || peticion.url === '/auth/login') {
    return siguiente(peticion);
  }

  return siguiente(
    peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};