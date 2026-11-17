import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ExamenesService } from './exams.service';
import { PreguntaRevision, RevisionIntento } from './exam.model';
import { EstadoIntento } from '../exam/exam.model';
import { mensajeDeError } from '../core/api/api-error';

interface FilaRevision {
  pregunta: PreguntaRevision;
  puntos: number | null;
}

@Component({
  selector: 'app-revision-intento',
  imports: [DatePipe, RouterLink],
  templateUrl: './attempt-review.html',
  styleUrl: './attempt-review.scss',
})
export class RevisionIntentoPantalla implements OnInit {
  private examenesService = inject(ExamenesService);
  private ruta = inject(ActivatedRoute);
  private router = inject(Router);

  revision = signal<RevisionIntento | null>(null);
  filas = signal<FilaRevision[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  mensajeError = signal<string | null>(null);
  errorAccion = signal<string | null>(null);
  private examenId = '';
  private intentoId = '';

  etiquetasEstado: Record<EstadoIntento, string> = {
    IN_PROGRESS: 'En curso',
    SUBMITTED: 'Entregado',
    GRADING: 'En corrección',
    GRADED: 'Corregido',
    CANCELLED: 'Cancelado',
  };

  ngOnInit(): void {
    this.examenId = this.ruta.snapshot.paramMap.get('id') ?? '';
    this.intentoId = this.ruta.snapshot.paramMap.get('intentoId') ?? '';
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    if (!this.examenId || !this.intentoId) {
      this.mensajeError.set('No se indicó qué intento querés corregir.');
      this.cargando.set(false);
      return;
    }

    this.examenesService.obtenerRevision(this.examenId, this.intentoId).subscribe({
      next: (revision) => {
        this.revision.set(revision);
        this.filas.set(
          revision.preguntas.map((pregunta) => ({
            pregunta,
            puntos: pregunta.puntosObtenidos,
          })),
        );
        this.cargando.set(false);
      },
      error: (error) => {
        this.mensajeError.set(mensajeDeError(error, 'No se pudo cargar el intento para corregir.'));
        this.cargando.set(false);
      },
    });
  }

  cambiarPuntos(indice: number, valor: string): void {
    const numero = valor === '' ? null : Number(valor);

    this.filas.update((filas) =>
      filas.map((fila, posicion) =>
        posicion === indice
          ? { ...fila, puntos: numero !== null && Number.isFinite(numero) ? numero : null }
          : fila,
      ),
    );
  }

  guardar(): void {
    const revision = this.revision();

    if (!revision) {
      return;
    }

    const editables = this.filas().filter((fila) => fila.pregunta.editable);

    if (editables.length === 0) {
      this.errorAccion.set('Este intento no tiene respuestas pendientes de corrección.');
      return;
    }

    for (const fila of editables) {
      if (fila.puntos === null) {
        this.errorAccion.set(`Ingresá los puntos de la pregunta ${fila.pregunta.posicion}.`);
        return;
      }

      if (fila.puntos < 0 || fila.puntos > fila.pregunta.puntos) {
        this.errorAccion.set(
          `Los puntos de la pregunta ${fila.pregunta.posicion} deben estar entre 0 y ${fila.pregunta.puntos}.`,
        );
        return;
      }
    }

    this.guardando.set(true);
    this.errorAccion.set(null);

    const calificaciones = editables.map((fila) => ({
      idExamenVersionPregunta: fila.pregunta.idExamenVersionPregunta,
      puntosObtenidos: fila.puntos as number,
    }));

    this.examenesService.guardarRevision(this.examenId, this.intentoId, calificaciones).subscribe({
      next: () => {
        this.guardando.set(false);
        this.router.navigate(['/profesor/examenes', this.examenId, 'resultados']);
      },
      error: (error) => {
        this.guardando.set(false);
        this.errorAccion.set(mensajeDeError(error, 'No se pudieron guardar las calificaciones.'));
      },
    });
  }
}
