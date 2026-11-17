import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ExamenesService } from './exams.service';
import { EstadoExamen, ExamenDetalle, IntentoExamenResumen, ModoLiberacion } from './exam.model';
import { EstadoIntento } from '../exam/exam.model';
import { mensajeDeError } from '../core/api/api-error';
import { BackLink } from '../shared/back-link/back-link';

@Component({
  selector: 'app-resultados-examen',
  imports: [DatePipe, RouterLink, BackLink],
  templateUrl: './exams-results.html',
  styleUrl: './exams-results.scss',
})
export class ResultadosExamen implements OnInit {
  private examenesService = inject(ExamenesService);
  private ruta = inject(ActivatedRoute);

  examen = signal<ExamenDetalle | null>(null);
  intentos = signal<IntentoExamenResumen[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  errorAccion = signal<string | null>(null);
  anuncio = signal<string | null>(null);
  liberando = signal(false);
  private examenId = '';

  etiquetasEstado: Record<EstadoExamen, string> = {
    DRAFT: 'Borrador',
    SCHEDULED: 'Programado',
    PUBLISHED: 'Publicado',
    CLOSED: 'Cerrado',
  };

  etiquetasEstadoIntento: Record<EstadoIntento, string> = {
    IN_PROGRESS: 'En curso',
    SUBMITTED: 'Entregado',
    GRADING: 'En corrección',
    GRADED: 'Corregido',
    CANCELLED: 'Cancelado',
  };

  etiquetasModo: Record<ModoLiberacion, string> = {
    IMMEDIATE: 'Inmediata al corregir',
    ON_CLOSE: 'Al cerrar el examen',
    MANUAL: 'Manual',
  };

  corregidos = computed(() => this.intentos().filter((intento) => intento.estado === 'GRADED').length);

  promedio = computed(() => {
    const conPuntaje = this.intentos().filter(
      (intento) => intento.estado === 'GRADED' && intento.puntajeTotal !== null && intento.puntajeMaximo,
    );

    if (conPuntaje.length === 0) {
      return null;
    }

    const acumulado = conPuntaje.reduce(
      (total, intento) => total + (intento.puntajeTotal ?? 0) / (intento.puntajeMaximo ?? 1),
      0,
    );

    return Math.round((acumulado / conPuntaje.length) * 10000) / 100;
  });

  puedeLiberar = computed(() => {
    const examen = this.examen();

    return Boolean(
      examen && examen.estado !== 'DRAFT' && examen.modoLiberacion === 'MANUAL' && !examen.liberadoEn,
    );
  });

  ngOnInit(): void {
    this.examenId = this.ruta.snapshot.paramMap.get('id') ?? '';
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    if (!this.examenId) {
      this.mensajeError.set('No se indicó qué examen querés consultar.');
      this.cargando.set(false);
      return;
    }

    forkJoin({
      examen: this.examenesService.obtener(this.examenId),
      intentos: this.examenesService.obtenerIntentos(this.examenId),
    }).subscribe({
      next: ({ examen, intentos }) => {
        this.examen.set(examen);
        this.intentos.set(intentos);
        this.cargando.set(false);
      },
      error: (error) => {
        this.mensajeError.set(mensajeDeError(error, 'No se pudieron cargar los resultados del examen.'));
        this.cargando.set(false);
      },
    });
  }

  liberar(): void {
    const examen = this.examen();

    if (!examen) {
      return;
    }

    this.liberando.set(true);
    this.errorAccion.set(null);
    this.anuncio.set(null);

    this.examenesService.liberarResultados(examen.id).subscribe({
      next: (resultado) => {
        this.liberando.set(false);
        this.examen.update((actual) => (actual ? { ...actual, liberadoEn: resultado.liberadoEn } : actual));
        this.anuncio.set('Los resultados quedaron liberados para los alumnos.');
      },
      error: (error) => {
        this.liberando.set(false);
        this.errorAccion.set(mensajeDeError(error, 'No se pudieron liberar los resultados.'));
      },
    });
  }

  etiquetaLiberacion(examen: ExamenDetalle): string {
    if (examen.modoLiberacion !== 'MANUAL') {
      return this.etiquetasModo[examen.modoLiberacion];
    }

    return examen.liberadoEn ? 'Liberados' : 'Pendientes de liberación';
  }

  puntaje(intento: IntentoExamenResumen): string {
    if (intento.puntajeTotal === null) {
      return '—';
    }

    return `${intento.puntajeTotal} / ${intento.puntajeMaximo ?? 0}`;
  }
}
