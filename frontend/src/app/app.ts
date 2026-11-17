import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from './core/auth/auth.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly autenticacion = inject(AuthService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
      map((evento) => evento.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly mostrarShell = computed(() => {
    const ruta = this.url().split('?')[0].split('#')[0];

    if (!this.autenticacion.isAuthenticated()) {
      return false;
    }

    if (ruta === '/landing' || ruta === '/login' || ruta === '/registro') {
      return false;
    }

    if (/^\/examen\/[^/]+/.test(ruta)) {
      return false;
    }

    return true;
  });

  readonly esAlumno = computed(() => this.autenticacion.user()?.role === 'STUDENT');
  readonly esDocente = computed(() => this.autenticacion.user()?.role === 'TEACHER');
  readonly inicio = computed(() => (this.esDocente() ? '/profesor' : '/grupos'));
  readonly rolEtiqueta = computed(() => (this.esDocente() ? 'Docente' : 'Alumno'));

  readonly nombre = computed(() => {
    const usuario = this.autenticacion.user();
    return usuario ? `${usuario.firstName} ${usuario.lastName}`.trim() : '';
  });

  readonly iniciales = computed(() => {
    const usuario = this.autenticacion.user();
    if (!usuario) {
      return '';
    }
    return `${usuario.firstName.charAt(0)}${usuario.lastName.charAt(0)}`.toUpperCase();
  });

  cerrarSesion(): void {
    this.autenticacion.logout();
    void this.router.navigate(['/landing']);
  }
}
