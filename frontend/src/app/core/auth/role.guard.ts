import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
    const authService = inject(AuthService);
    const requiredRole = route.data['role'];
    const userRole = authService.user()?.role;
    
    if (!userRole) {
        return false;
    }
    return userRole === requiredRole;
};