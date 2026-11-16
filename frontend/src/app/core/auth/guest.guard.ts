import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const guestGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.hasValidSession()) {
        return true;
    }

    const role = authService.user()?.role;

    if (role === 'STUDENT') {
        return router.createUrlTree(['/grupos']);
    }

    if (role === 'TEACHER') {
        return router.createUrlTree(['/profesor']);
    }
    authService.logout();
    return true;
};