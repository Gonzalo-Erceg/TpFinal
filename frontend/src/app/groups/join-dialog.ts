import { Component, inject, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { GruposService } from './groups.service';
import { Grupo } from './group.model';

@Component({
  selector: 'app-dialogo-unirse',
  imports: [ReactiveFormsModule],
  templateUrl: './join-dialog.html',
  styleUrl: './join-dialog.scss',
})
export class DialogoUnirse {
  private gruposService = inject(GruposService);

  // Eventos que el diálogo le avisa al componente padre
  solicitudEnviada = output<Grupo>();
  cerrar = output<void>();

  // Campo del código con sus validaciones
  codigo = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9]{6}$/)],
  });

  enviando = signal(false);
  errorServidor = signal<string | null>(null);

  enviar(evento: Event): void {
    evento.preventDefault();
    this.errorServidor.set(null);

    // Si el código no pasa las validaciones, no se llama a la API
    if (this.codigo.invalid) {
      this.codigo.markAsTouched();
      return;
    }

    this.enviando.set(true);

    this.gruposService.unirseAGrupo(this.codigo.value.toUpperCase()).subscribe({
      next: (grupo) => {
        this.enviando.set(false);
        this.solicitudEnviada.emit(grupo);
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
        return 'El código no tiene un formato válido.';
      case 404:
        return 'El código no existe. Revisalo e intentá de nuevo.';
      case 409:
        return 'Ya pertenecés a este grupo o ya enviaste una solicitud.';
      default:
        return 'No se pudo enviar la solicitud. Intentá de nuevo más tarde.';
    }
  }
}