import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AutenticacionService } from '../auth.service';
import { RolUsuario } from '../auth.model';

// El backend solo exige 8 caracteres; letra y número los pedimos desde el front
const REQUISITOS_CONTRASENA = [
  { texto: 'Al menos 8 caracteres', cumple: (valor: string) => valor.length >= 8 },
  { texto: 'Al menos una letra', cumple: (valor: string) => /\p{L}/u.test(valor) },
  { texto: 'Al menos un número', cumple: (valor: string) => /\d/.test(valor) },
];

const contrasenaSegura: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  REQUISITOS_CONTRASENA.every((r) => r.cumple(control.value ?? '')) ? null : { contrasenaDebil: true };

const contrasenasIguales: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const contrasena = grupo.get('contrasena')?.value;
  const confirmacion = grupo.get('confirmacion')?.value;
  return confirmacion && contrasena !== confirmacion ? { contrasenasDistintas: true } : null;
};

const textoObligatorio = [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)];

type CampoRegistro = 'nombre' | 'apellido' | 'email' | 'contrasena' | 'confirmacion';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['../login/login.scss', './register.scss'],
})
export class Registro {
  private autenticacion = inject(AutenticacionService);
  private router = inject(Router);

  formulario = new FormGroup(
    {
      nombre: new FormControl('', { nonNullable: true, validators: textoObligatorio }),
      apellido: new FormControl('', { nonNullable: true, validators: textoObligatorio }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email, Validators.maxLength(255)] }),
      contrasena: new FormControl('', { nonNullable: true, validators: [Validators.required, contrasenaSegura] }),
      confirmacion: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      rol: new FormControl<RolUsuario>('STUDENT', { nonNullable: true }),
    },
    { validators: contrasenasIguales },
  );

  cargando = signal(false);
  mensajeError = signal<string | null>(null);

  private contrasena = toSignal(this.formulario.controls.contrasena.valueChanges, { initialValue: '' });

  requisitos = computed(() =>
    REQUISITOS_CONTRASENA.map((r) => ({ texto: r.texto, cumple: r.cumple(this.contrasena()) })),
  );

  tieneError(campo: CampoRegistro): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  confirmacionDistinta(): boolean {
    return this.formulario.controls.confirmacion.touched && this.formulario.hasError('contrasenasDistintas');
  }

  enviar(): void {
    this.mensajeError.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { nombre, apellido, email, contrasena, rol } = this.formulario.getRawValue();
    this.cargando.set(true);

    this.autenticacion.registrar({ nombre, apellido, email, contrasena, rol }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.router.navigate(['/login'], { queryParams: { registrado: 'si' } });
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
        // El backend manda en message qué dato está mal
        return error.error?.message ?? 'Revisá los datos del formulario.';
      case 409:
        return 'Ya existe una cuenta con ese email. Iniciá sesión o usá otro email.';
      case 0:
        return 'No se pudo conectar con el servidor. Intentá de nuevo más tarde.';
      default:
        return 'No se pudo crear la cuenta. Intentá de nuevo.';
    }
  }
}