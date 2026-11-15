import { Component, OnInit, inject, signal } from '@angular/core';
import { PreguntasService } from './questions.service';
import { TipoPregunta, Pregunta } from './question.model';

@Component({
  imports: [],
  selector: 'app-banco-preguntas',
  styleUrl: './question-bank.scss',
  templateUrl: './question-bank.html',
})
export class BancoPreguntas implements OnInit {
  private preguntasService = inject(PreguntasService);

  preguntas = signal<Pregunta[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  errorAccion = signal<string | null>(null);
  filtroTipo = signal<TipoPregunta | null>(null);
  preguntaAbierta = signal<string | null>(null);

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

  tiposFiltro: TipoPregunta[] = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT'];

  ngOnInit(): void {
    this.cargarPreguntas();
  }

  cargarPreguntas(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    this.preguntasService.obtenerPreguntas(this.filtroTipo() ?? undefined).subscribe({
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

  elegirFiltro(tipo: TipoPregunta | null): void {
    this.filtroTipo.set(tipo);
    this.cargarPreguntas();
  }

  eliminar(pregunta: Pregunta): void {
    if (!confirm(`¿Seguro que querés borrar "${pregunta.titulo ?? pregunta.enunciado}"?`)){
      return;
    }
    this.errorAccion.set(null);

    this.preguntasService.eliminarPregunta(pregunta.id).subscribe({
      next: () => {
        // sacar la pregunta eliminada de la lista
        this.preguntas.set(this.preguntas().filter((p) => p.id !== pregunta.id));
      },
      error: () => {
        this.errorAccion.set('No se pudo eliminar la pregunta. Intentá de nuevo.');
      },
    });
  }

  alternarDetalle(pregunta: Pregunta): void {
    if (this.preguntaAbierta() === pregunta.id) {
      this.preguntaAbierta.set(null);
    } else {
      this.preguntaAbierta.set(pregunta.id);
    }
  }

}
