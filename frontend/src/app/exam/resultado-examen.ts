import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExamenService } from './exam.service';
import { ResultadoExamen, RespuestaResultado, TipoPregunta } from './exam.model';
import { mensajeDeError } from '../core/api/api-error';
import { BackLink } from '../shared/back-link/back-link';

@Component({
  selector: 'app-resultado-examen',
  imports: [DatePipe, RouterLink, BackLink],
  templateUrl: './resultado-examen.html',
  styleUrl: './resultado-examen.scss',
})
export class ResultadoExamenPantalla implements OnInit {
  private examenService = inject(ExamenService);
  private ruta = inject(ActivatedRoute);

  resultado = signal<ResultadoExamen | null>(null);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  noDisponible = signal<string | null>(null);
  private intentoId = '';

  etiquetasTipo: Record<TipoPregunta, string> = {
    CHOICE: 'Opción única',
    MULTIPLE_CHOICE: 'Opción múltiple',
    TRUE_FALSE: 'Verdadero o falso',
    SHORT_TEXT: 'Respuesta corta',
    ESSAY: 'Desarrollo',
    NO_SOPORTADO: 'Tipo no disponible',
  };

  titulo = computed(() => 'Resultado del examen');

  ngOnInit(): void {
    this.intentoId = this.ruta.snapshot.paramMap.get('intentoId') ?? '';
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);
    this.noDisponible.set(null);

    if (!this.intentoId) {
      this.mensajeError.set('No se indicó qué resultado querés ver.');
      this.cargando.set(false);
      return;
    }

    this.examenService.obtenerResultado(this.intentoId).subscribe({
      next: (resultado) => {
        this.resultado.set(resultado);
        this.cargando.set(false);
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.noDisponible.set(
            mensajeDeError(error, 'El resultado todavía no está disponible. Tu docente lo va a habilitar.'),
          );
        } else if (error instanceof HttpErrorResponse && error.status === 404) {
          this.mensajeError.set('El intento no existe o no te pertenece.');
        } else {
          this.mensajeError.set(mensajeDeError(error, 'No se pudo cargar el resultado. Intentá de nuevo.'));
        }

        this.cargando.set(false);
      },
    });
  }

  esCorrecta(respuesta: RespuestaResultado): boolean {
    return respuesta.correcta;
  }

  estaElegida(respuesta: RespuestaResultado, opcionId: string): boolean {
    return respuesta.opcionesSeleccionadas.includes(opcionId);
  }

  esCorrectaOpcion(respuesta: RespuestaResultado, opcionId: string): boolean {
    return respuesta.opcionesCorrectas.includes(opcionId);
  }

  esOpcionIncorrecta(respuesta: RespuestaResultado, opcionId: string): boolean {
    return (
      respuesta.opcionesCorrectas.length > 0 &&
      this.estaElegida(respuesta, opcionId) &&
      !this.esCorrectaOpcion(respuesta, opcionId)
    );
  }

  textoRespuesta(respuesta: RespuestaResultado): string | null {
    const texto = respuesta.respuestaTexto?.trim();

    return texto ? texto : null;
  }

  tieneOpciones(respuesta: RespuestaResultado): boolean {
    return respuesta.opciones.length > 0;
  }

  etiquetaVeredicto(respuesta: RespuestaResultado): string {
    if (respuesta.puntosObtenidos === null) {
      return 'Pendiente de revisión';
    }

    if (this.esCorrecta(respuesta)) {
      return 'Correcta';
    }

    return respuesta.puntosObtenidos > 0 ? 'Parcialmente correcta' : 'Incorrecta';
  }

  claseVeredicto(respuesta: RespuestaResultado): string {
    if (respuesta.puntosObtenidos === null) {
      return 'pendiente';
    }

    if (this.esCorrecta(respuesta)) {
      return 'bien';
    }

    return respuesta.puntosObtenidos > 0 ? 'parcial' : 'mal';
  }
}
