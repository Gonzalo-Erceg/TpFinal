import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ExamenService } from './exam.service';
import { Examen, Pregunta, Respuesta, TipoPregunta } from './exam.model';
import { RespuestaChoice } from './choice-answer';
import { RespuestaTrueFalse } from './true-false-answer';
import { RespuestaShortText } from './short-text-answer';

@Component({
  selector: 'app-pantalla-examen',
  imports: [RespuestaChoice, RespuestaTrueFalse, RespuestaShortText],
  templateUrl: './exam-screen.html',
  styleUrl: './exam-screen.scss',
})
export class PantallaExamen implements OnInit {
  private examenService = inject(ExamenService);

  examen = signal<Examen | null>(null);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  indiceActual = signal(0);
  respuestas = signal<Record<number, Respuesta>>({});

  etiquetasTipo: Record<TipoPregunta, string> = {
    CHOICE: 'Opción múltiple',
    TRUE_FALSE: 'Verdadero o falso',
    SHORT_TEXT: 'Respuesta corta',
  };

  totalPreguntas = computed(() => this.examen()?.preguntas.length ?? 0);

  preguntaActual = computed(() => this.examen()?.preguntas[this.indiceActual()] ?? null);

  respuestaActual = computed(() => {
    const pregunta = this.preguntaActual();
    return pregunta ? this.respuestas()[pregunta.id] : undefined;
  });

  resumenPreguntas = computed(() =>
    (this.examen()?.preguntas ?? []).map((pregunta) => ({
      id: pregunta.id,
      enunciado: pregunta.enunciado,
      respondida: this.tieneRespuesta(pregunta),
    })),
  );

  respondidas = computed(() => this.resumenPreguntas().filter((pregunta) => pregunta.respondida).length);

  porcentaje = computed(() =>
    this.totalPreguntas() === 0 ? 0 : Math.round((this.respondidas() / this.totalPreguntas()) * 100),
  );

  esPrimera = computed(() => this.indiceActual() === 0);
  esUltima = computed(() => this.indiceActual() === this.totalPreguntas() - 1);

  ngOnInit(): void {
    this.cargarExamen();
  }

  cargarExamen(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    this.examenService.obtenerExamen().subscribe({
      next: (examen) => {
        this.examen.set(examen);
        this.cargando.set(false);
      },
      error: () => {
        this.mensajeError.set('No se pudo cargar el examen. Intentá de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  irA(indice: number): void {
    if (indice >= 0 && indice < this.totalPreguntas()) {
      this.indiceActual.set(indice);
    }
  }

  anterior(): void {
    this.irA(this.indiceActual() - 1);
  }

  siguiente(): void {
    this.irA(this.indiceActual() + 1);
  }

  guardarRespuesta(valor: Respuesta): void {
    const pregunta = this.preguntaActual();
    if (!pregunta) {
      return;
    }
    this.respuestas.update((actuales) => ({ ...actuales, [pregunta.id]: valor }));
  }

  // Un texto con solo espacios no cuenta como respondido, pero false sí es una respuesta válida
  private tieneRespuesta(pregunta: Pregunta): boolean {
    const valor = this.respuestas()[pregunta.id];
    if (typeof valor === 'string') {
      return valor.trim().length > 0;
    }
    return typeof valor === 'boolean';
  }
}