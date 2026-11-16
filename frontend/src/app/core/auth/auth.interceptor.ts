import {
	HttpErrorResponse,
	HttpInterceptorFn
} from '@angular/common/http';

import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
	const authService = inject(AuthService);
	const token = authService.token();

	const rutaPublica = req.url === '/auth/login' || req.url === '/auth/register';

	const requiereToken = req.url.startsWith('/') && !req.url.startsWith('//') && !rutaPublica;

	if (!token || !requiereToken) {
		return next(req);
	}

	const authReq = req.clone({
		setHeaders: {
			Authorization: `Bearer ${token}`
		}
	});

	return next(authReq).pipe(
		catchError((error: HttpErrorResponse) => {
			if (error.status === 401) {
				authService.logout();
			}

			return throwError(() => error);
		})
	);
};