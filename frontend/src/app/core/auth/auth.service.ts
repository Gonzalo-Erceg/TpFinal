import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: 'STUDENT' | 'TEACHER';
}

interface LoginResponse {
    user: User;
    token: string;
}

interface RegisterData {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: 'STUDENT' | 'TEACHER';
}

@Injectable({
    providedIn: 'root'
})

export class AuthService {
    user = signal<User | null>(null);
    token = signal<string | null>(null);

    isAuthenticated = computed(() => this.user() !== null);

    constructor(private http: HttpClient) {
        const storedToken = sessionStorage.getItem('token');
        const storedUser = sessionStorage.getItem('user');

        if (storedToken && storedUser) {
            if (this.isTokenExpired(storedToken)) {
                this.logout();
                return;
            }
        this.token.set(storedToken);
        this.user.set(JSON.parse(storedUser));
        }
    }

    private isTokenExpired(token: string): boolean {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.exp <= Date.now() / 1000;
        } 
        catch {
            return true;
        }
    }

    login(email: string, password: string) {
        return this.http.post<LoginResponse>('/auth/login', {
        email, password
        }).pipe(
        tap((response) => {
            this.user.set(response.user);
            this.token.set(response.token);

            sessionStorage.setItem('token', response.token);
            sessionStorage.setItem('user', JSON.stringify(response.user));
            })
        );
    }

    logout(): void {
        this.user.set(null);
        this.token.set(null);
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
    }

    register(data: RegisterData) {
        return this.http.post('/auth/register', data);
    }
}