import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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

	isAuthenticated = computed(() => this.user() !== null && this.token() !== null);

	private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	constructor(private http: HttpClient) {
		if (!this.isBrowser) {
			return;
		}
		try{
			const storedToken = sessionStorage.getItem('token');
			const storedUser = sessionStorage.getItem('user');

			if (!storedToken || !storedUser || this.isTokenExpired(storedToken)) {
                this.logout();
                return;
            }
			this.user.set(JSON.parse(storedUser));
            this.token.set(storedToken);

		} catch {
			this.logout();
		}
	}

	private isTokenExpired(token: string): boolean {
		try {
			const payload = JSON.parse(atob(token.split('.')[1]));

			return typeof payload.exp !== 'number' || payload.exp <= Date.now() / 1000;
		} catch {
			return true;
		}
	}

	hasValidSession(): boolean {
		const token = this.token();
		const user = this.user();

		if (!token || !user || this.isTokenExpired(token)) {
			this.logout();
			return false;
		}
		return true;
	}

	login(email: string, password: string) {
		return this.http.post<LoginResponse>('/auth/login', {
			email,
			password
		}).pipe(
			tap((response) => {
				this.user.set(response.user);
				this.token.set(response.token);

				if (this.isBrowser) {
					sessionStorage.setItem('token', response.token);
					sessionStorage.setItem('user', JSON.stringify(response.user));
				}
			})
		);
	}

	logout(): void {
		this.user.set(null);
		this.token.set(null);

		if (this.isBrowser) {
			sessionStorage.removeItem('token');
			sessionStorage.removeItem('user');
		}
	}

	register(data: RegisterData) {
		return this.http.post('/auth/register', data);
	}
}