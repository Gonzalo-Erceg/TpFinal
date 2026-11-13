import { Component, inject, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { GruposService } from './groups.service';
import { GrupoDelProfesor } from './group.model';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-dialogo-crear-grupo',
  styleUrl: './create-group-dialog.scss',
  templateUrl: './create-group-dialog.html',
})
export class DialogoCrearGrupo {
  private gruposService = inject(GruposService);
  
    // Eventos que el diálogo le avisa al componente padre
  grupoCreado = output<GrupoDelProfesor>();
  cerrar = output<void>();

  // Campo del nombre con sus validaciones
  nombre = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(150)],
  });

  enviando = signal(false);
  errorServidor = signal<string | null>(null);

    enviar(evento: Event): void {
    evento.preventDefault();
    this.errorServidor.set(null);

    // Si el nombre no pasa las validaciones, no se llama a la API
    if (this.nombre.invalid) {
      this.nombre.markAsTouched();
      return;
    }

    this.enviando.set(true);

    this.gruposService.crearGrupo(this.nombre.value.trim()).subscribe({
      next: (grupo) => {
        this.enviando.set(false);
        this.grupoCreado.emit(grupo);
      },
      error: (error: HttpErrorResponse) => {
        this.enviando.set(false);
        this.errorServidor.set(this.mensajeParaError(error));
      },
    });
  }
  
  private mensajeParaError(error: HttpErrorResponse): string {
    switch (error.status) {
      case 400:
        return 'El nombre no tiene un formato válido.';
      default:
        return 'No se pudo crear el grupo. Intentá de nuevo más tarde.';
    }
  }
}
