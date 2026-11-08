import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { delay, map, switchMap, tap } from 'rxjs/operators';
import { RolUsuario, UsuarioPublico } from './auth.model';

// Pasar a false cuando POST /auth/login funcione en el backend
const USAR_DATOS_DE_PRUEBA = true;

const CLAVE_TOKEN = 'aula-token';
const CLAVE_USUARIO = 'aula-usuario';

// Pantalla de destino de cada rol. Esas rutas todavía no existen.
export const RUTAS_POR_ROL: Record<RolUsuario, string> = {
  STUDENT: '/grupos',
  TEACHER: '/profesor',
};

// Así responde el backend (campos en inglés)
interface UsuarioApi {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: RolUsuario;
}

interface RespuestaLoginApi {
  token: string;
  user: UsuarioApi;
}

@Injectable({ providedIn: 'root' })
export class AutenticacionService {
  private http = inject(HttpClient);
  private esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  private tokenActual = signal<string | null>(null);

  usuarioActual = signal<UsuarioPublico | null>(null);
  estaAutenticado = computed(() => this.tokenActual() !== null);

  // Usuarios de prueba, todos con la misma contraseña
  private usuariosDePrueba = [
    {
      contrasena: 'password123',
      deshabilitado: false,
      usuario: { id: '1', firstName: 'Ana', lastName: 'Gómez', email: 'alumno@ejemplo.com', role: 'STUDENT' as RolUsuario },
    },
    {
      contrasena: 'password123',
      deshabilitado: false,
      usuario: { id: '2', firstName: 'Martín', lastName: 'Suárez', email: 'profesor@ejemplo.com', role: 'TEACHER' as RolUsuario },
    },
    {
      contrasena: 'password123',
      deshabilitado: true,
      usuario: { id: '3', firstName: 'Lucía', lastName: 'Pérez', email: 'deshabilitado@ejemplo.com', role: 'STUDENT' as RolUsuario },
    },
  ];

  constructor() {
    this.recuperarSesion();
  }

  iniciarSesion(email: string, contrasena: string): Observable<UsuarioPublico> {
    const respuesta$ = USAR_DATOS_DE_PRUEBA
      ? this.iniciarSesionDePrueba(email, contrasena)
      : this.http.post<RespuestaLoginApi>('/auth/login', { email, password: contrasena });

    return respuesta$.pipe(
      tap((respuesta) => this.guardarSesion(respuesta)),
      map((respuesta) => this.aUsuario(respuesta.user)),
    );
  }

  cerrarSesion(): void {
    this.tokenActual.set(null);
    this.usuarioActual.set(null);

    if (this.esNavegador) {
      try {
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_USUARIO);
      } catch {
        // sin acceso al almacenamiento, no hay nada que borrar
      }
    }
  }

  obtenerToken(): string | null {
    return this.tokenActual();
  }

  private aUsuario(usuarioApi: UsuarioApi): UsuarioPublico {
    return {
      id: usuarioApi.id,
      nombre: usuarioApi.firstName,
      apellido: usuarioApi.lastName,
      email: usuarioApi.email,
      rol: usuarioApi.role,
    };
  }

  private guardarSesion(respuesta: RespuestaLoginApi): void {
    const usuario = this.aUsuario(respuesta.user);

    this.tokenActual.set(respuesta.token);
    this.usuarioActual.set(usuario);

    // En el servidor (SSR) no existe localStorage
    if (this.esNavegador) {
      try {
        localStorage.setItem(CLAVE_TOKEN, respuesta.token);
        localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
      } catch {
        // la sesión sigue activa hasta recargar la página
      }
    }
  }

  private recuperarSesion(): void {
    if (!this.esNavegador) {
      return;
    }

    try {
      const token = localStorage.getItem(CLAVE_TOKEN);
      const usuario = localStorage.getItem(CLAVE_USUARIO);

      if (token && usuario) {
        this.tokenActual.set(token);
        this.usuarioActual.set(JSON.parse(usuario) as UsuarioPublico);
      }
    } catch {
      this.cerrarSesion();
    }
  }

  private iniciarSesionDePrueba(email: string, contrasena: string): Observable<RespuestaLoginApi> {
    const emailNormalizado = email.trim().toLowerCase();
    const encontrado = this.usuariosDePrueba.find((u) => u.usuario.email === emailNormalizado);

    // El backend real devolvería 401
    if (!encontrado || encontrado.contrasena !== contrasena) {
      return this.errorConDemora(401);
    }

    // El backend real devolvería 403
    if (encontrado.deshabilitado) {
      return this.errorConDemora(403);
    }

    return of({ token: 'token-de-prueba', user: encontrado.usuario }).pipe(delay(800));
  }

  // delay() no demora los errores, por eso se usa timer()
  private errorConDemora(status: number): Observable<never> {
    return timer(800).pipe(switchMap(() => throwError(() => new HttpErrorResponse({ status }))));
  }
}