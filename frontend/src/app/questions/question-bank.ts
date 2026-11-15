import { Component, OnInit, inject, signal } from '@angular/core';
import { PreguntasService } from './questions.service';
import { TipoPregunta, OpcionPregunta, Pregunta } from './question.model';

@Component({
  imports: [],
  selector: 'app-banco-preguntas',
  styleUrl: './question-bank.scss',
  templateUrl: './question-bank.html',
})
export class BancoPreguntas implements OnInit{
   private preguntasService = inject(PreguntasService);

  preguntas = signal<Pregunta[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);

  etiquetasTipo: Record<TipoPregunta, string> = {
    SINGLE_CHOICE: 'Opción única',
    MULTIPLE_CHOICE: 'Opción múltiple',
    TRUE_FALSE: 'Verdadero o falso',
    SHORT_TEXT: 'Respuesta corta',
    ESSAY: 'Desarrollo',
    MATCHING: 'Relacionar',
    ORDERING: 'Ordenar',
    FILE_UPLOAD: 'Subir archivo',
  };

  ngOnInit(): void {
    this.cargarPreguntas();
  }

  cargarPreguntas(): void {
        this.cargando.set(true);
    this.mensajeError.set(null);

    this.preguntasService.obtenerPreguntas().subscribe({
      next: (preguntas) => {
        this.preguntas.set(preguntas);
        this.cargando.set(false);
      },
      error: () => {
        this.mensajeError.set('No se pudieron cargar tus preguntas. Intentá de nuevo.');
        this.cargando.set(false);
      },
    });

  }

}
