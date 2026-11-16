import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
    const router = inject(Router);
    const authService = inject(AuthService);

    if (!authService.hasValidSession()) {
        return router.createUrlTree(['/login']);
    }

    const requiredRole = route.data['role'];
    const userRole = authService.user()?.role;

    if (userRole === requiredRole) {
        return true;
    }

    if (userRole === 'STUDENT') {
        return router.createUrlTree(['/grupos']);
    }

    if (userRole === 'TEACHER') {
        return router.createUrlTree(['/profesor']);
    }

    authService.logout();
    return router.createUrlTree(['/login']);
};