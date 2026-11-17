import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExamenesService } from './exams.service';
import { EstadoExamen, ExamenResumen } from './exam.model';
import { mensajeDeError } from '../core/api/api-error';

@Component({
  selector: 'app-lista-examenes',
  imports: [DatePipe, RouterLink],
  templateUrl: './exams-list.html',
  styleUrl: './exams-list.scss',
})
export class ListaExamenes implements OnInit {
  private examenesService = inject(ExamenesService);

  examenes = signal<ExamenResumen[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  errorAccion = signal<string | null>(null);
  anuncio = signal<string | null>(null);
  procesando = signal<string | null>(null);

  etiquetasEstado: Record<EstadoExamen, string> = {
    DRAFT: 'Borrador',
    SCHEDULED: 'Programado',
    PUBLISHED: 'Publicado',
    CLOSED: 'Cerrado',
  };

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    this.examenesService.listar().subscribe({
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

  publicar(examen: ExamenResumen): void {
    this.procesando.set(examen.id);
    this.errorAccion.set(null);
    this.anuncio.set(null);

    this.examenesService.publicar(examen.id).subscribe({
      next: (resultado) => {
        this.procesando.set(null);
        this.anuncio.set(`"${examen.titulo}" quedó ${this.etiquetasEstado[resultado.status].toLowerCase()}.`);
        this.cargar();
      },
      error: (error) => {
        this.procesando.set(null);
        this.errorAccion.set(mensajeDeError(error, 'No se pudo publicar el examen.'));
      },
    });
  }

  cerrar(examen: ExamenResumen): void {
    this.procesando.set(examen.id);
    this.errorAccion.set(null);
    this.anuncio.set(null);

    this.examenesService.cerrar(examen.id).subscribe({
      next: () => {
        this.procesando.set(null);
        this.anuncio.set(`"${examen.titulo}" quedó cerrado.`);
        this.cargar();
      },
      error: (error) => {
        this.procesando.set(null);
        this.errorAccion.set(mensajeDeError(error, 'No se pudo cerrar el examen.'));
      },
    });
  }
}
