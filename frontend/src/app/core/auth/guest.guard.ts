import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const guestGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
    return true;
    }

    const role = authService.user()?.role;

    if (role === 'STUDENT') {
    return router.createUrlTree(['/grupos']);
    }

    if (role === 'TEACHER') {
    // TODO: confirmar/reemplazar cuando exista el dashboard/home del profesor.
    return router.createUrlTree(['/profesor']);
    }

    return false;
};