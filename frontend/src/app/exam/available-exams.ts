import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExamenService } from './exam.service';
import { ExamenDisponible } from './exam.model';
import { mensajeDeError } from '../core/api/api-error';

@Component({
  selector: 'app-lista-examenes-alumno',
  imports: [DatePipe, RouterLink],
  templateUrl: './available-exams.html',
  styleUrl: './available-exams.scss',
})
export class ListaExamenesAlumno implements OnInit {
  private examenService = inject(ExamenService);

  examenes = signal<ExamenDisponible[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    this.examenService.listarDisponibles().subscribe({
      next: (examenes) => {
        this.examenes.set(examenes);
        this.cargando.set(false);
      },
      error: (error) => {
        this.mensajeError.set(mensajeDeError(error, 'No se pudieron cargar tus exámenes.'));
        this.cargando.set(false);
      },
    });
  }

  motivoNoDisponible(examen: ExamenDisponible): string {
    if (examen.duracionMinutos === null && examen.cierraEn === null) {
      return 'El docente todavía no configuró la duración ni el cierre.';
    }

    if (examen.ultimoIntentoEstado === 'GRADING') {
      return 'La corrección de tu intento todavía está pendiente.';
    }

    if (examen.ultimoIntentoEstado === 'GRADED') {
      return 'Tu resultado está corregido, pero el docente todavía no lo liberó.';
    }

    return 'No te quedan intentos disponibles.';
  }

  etiquetaEstado(examen: ExamenDisponible): string {
    if (examen.intentoEnCurso) {
      return 'En curso';
    }

    if (examen.resultadoDisponible) {
      return 'Resultado disponible';
    }

    return 'Disponible';
  }

  etiquetaDuracion(examen: ExamenDisponible): string {
    if (examen.duracionMinutos !== null) {
      return `${examen.duracionMinutos} min`;
    }

    return examen.cierraEn ? 'Hasta el cierre' : 'Sin límite';
  }
}
