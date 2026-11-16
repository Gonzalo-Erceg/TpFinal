import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
@Component({
  selector: 'app-inicio-sesion',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class InicioSesion {
  private autenticacion = inject(AuthService);
  private router = inject(Router);

  private ruta = inject(ActivatedRoute);

  // Viene del registro: /login?registrado=si
  registroExitoso = this.ruta.snapshot.queryParamMap.get('registrado') === 'si';

  formulario = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    contrasena: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  cargando = signal(false);
  mensajeError = signal<string | null>(null);

  enviar(): void {
    this.mensajeError.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { email, contrasena } = this.formulario.getRawValue();
    this.cargando.set(true);

    this.autenticacion.login(email, contrasena).subscribe({
      next: (respuesta) => {
        this.cargando.set(false);
        
        const rutasPorRol = {
          STUDENT: '/grupos',
          TEACHER: '/profesor',
        };

        const destino = rutasPorRol[respuesta.user.role];
        this.router.navigateByUrl(destino);
      },
      error: (error: HttpErrorResponse) => {
        this.cargando.set(false);
        this.mensajeError.set(this.mensajeParaError(error));
      },
    });
  }

  private mensajeParaError(error: HttpErrorResponse): string {
    switch (error.status) {
      case 400:
        return 'Revisá que el email y la contraseña estén completos.';
      case 401:
        return 'El email o la contraseña no son correctos.';
      case 403:
        return 'Tu usuario está deshabilitado. Consultá con un administrador.';
      case 0:
        return 'No se pudo conectar con el servidor. Intentá de nuevo más tarde.';
      default:
        return 'No se pudo iniciar sesión. Intentá de nuevo.';
    }
  }
}
