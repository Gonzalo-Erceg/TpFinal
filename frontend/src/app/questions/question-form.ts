import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PreguntasService } from './questions.service';
import { TipoPregunta, DatosPregunta, OpcionNueva } from './question.model';

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  selector: 'app-formulario-pregunta',
  styleUrl: './question-form.scss',
  templateUrl: './question-form.html',
})
export class FormularioPregunta {
  private preguntasService = inject(PreguntasService);
  private router = inject(Router);

  titulo = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] });
  enunciado = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  tipo = signal<TipoPregunta>('TRUE_FALSE');
  verdaderoEsCorrecta = signal(true);
  opciones = signal<OpcionNueva[]>([
    { contenido: '', fraccionCredito: 1 },
    { contenido: '', fraccionCredito: 0 },
  ]);
  sumaPositivos = computed(() =>
    this.opciones()
      .filter((opcion) => opcion.fraccionCredito > 0)
      .reduce((suma, opcion) => suma + opcion.fraccionCredito, 0)
  );
  respuestas = signal<string[]>(['']);
  distingueMayusculas = signal(false);
  guardando = signal(false);
  mensajeError = signal<string | null>(null);


  tiposDisponibles: TipoPregunta[] = ['TRUE_FALSE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SHORT_TEXT'];

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

  elegirTipo(tipo: TipoPregunta): void {
    this.tipo.set(tipo);
  }

  agregarOpcion(): void {
    this.opciones.set([...this.opciones(), { contenido: '', fraccionCredito: 0 }]);
  }

  quitarOpcion(indice: number): void {
    this.opciones.set(this.opciones().filter((opcion, i) => i !== indice));
  }

  cambiarContenido(indice: number, texto: string): void {
    this.opciones.set(
      this.opciones().map((opcion, i) => (i === indice ? { ...opcion, contenido: texto } : opcion))
    );
  }

  marcarCorrecta(indice: number): void {
    this.opciones.set(
      this.opciones().map((opcion, i) => ({ ...opcion, fraccionCredito: i === indice ? 1 : 0 }))
    );
  }

  cambiarCredito(indice: number, valor: number): void {
    this.opciones.set(
      this.opciones().map((opcion, i) => (i === indice ? { ...opcion, fraccionCredito: valor } : opcion))
    );
  }

  agregarRespuesta(): void {
    this.respuestas.set([...this.respuestas(), '']);
  }

  quitarRespuesta(indice: number): void {
    this.respuestas.set(this.respuestas().filter((respuesta, i) => i !== indice));
  }

  cambiarRespuesta(indice: number, texto: string): void {
    this.respuestas.set(this.respuestas().map((respuesta, i) => (i === indice ? texto : respuesta)));
  }

  private armarOpciones(): OpcionNueva[] {
    if (this.tipo() === 'TRUE_FALSE') {
      return [
        { contenido: 'Verdadero', fraccionCredito: this.verdaderoEsCorrecta() ? 1 : 0 },
        { contenido: 'Falso', fraccionCredito: this.verdaderoEsCorrecta() ? 0 : 1 },
      ];
    }
    if (this.tipo() === 'SINGLE_CHOICE' || this.tipo() === 'MULTIPLE_CHOICE') {
      return this.opciones().map((opcion) => ({
        contenido: opcion.contenido.trim(),
        fraccionCredito: opcion.fraccionCredito,
      }));
    }
    return [];
  }

  guardar(): void {
    if (this.titulo.invalid || this.enunciado.invalid) {
      this.titulo.markAsTouched();
      this.enunciado.markAsTouched();
      this.mensajeError.set('Completá el título y el enunciado.');
      return;
    }

    if ((this.tipo() === 'SINGLE_CHOICE' || this.tipo() === 'MULTIPLE_CHOICE') && this.opciones().some((opcion) => !opcion.contenido.trim())) {
      this.mensajeError.set('Completá el texto de todas las opciones.');
      return;
    }

    if (this.tipo() === 'MULTIPLE_CHOICE' && Math.round(this.sumaPositivos() * 100) !== 100) {
      this.mensajeError.set('Los créditos positivos tienen que sumar 1.');
      return;
    }

    if (this.tipo() === 'SHORT_TEXT' && this.respuestas().every((respuesta) => !respuesta.trim())) {
      this.mensajeError.set('Escribí al menos una respuesta aceptada.');
      return;
    }

    const datos: DatosPregunta = {
      titulo: this.titulo.value.trim(),
      tipo: this.tipo(),
      enunciado: this.enunciado.value.trim(),
      opciones: this.armarOpciones(),
      respuestasAceptadas: this.respuestas().map((r) => r.trim()).filter((r) => r !== ''),
      distingueMayusculas: this.distingueMayusculas(),
    };

    this.guardando.set(true);
    this.mensajeError.set(null);

    this.preguntasService.crearPregunta(datos).subscribe({
      next: () => {
        this.router.navigate(['/preguntas']);
      },
      error: (err) => {
        this.mensajeError.set(err.error?.message ?? 'No se pudo guardar la pregunta.');
        this.guardando.set(false);
      },
    });
  }
}