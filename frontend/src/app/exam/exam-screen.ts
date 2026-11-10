import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
export class PantallaExamen implements OnInit, OnDestroy {
  private examenService = inject(ExamenService);
  private plataforma = inject(PLATFORM_ID);
  private idIntervalo: ReturnType<typeof setInterval> | null = null;

  private numeroGuardado = 0;

  ahora = signal(Date.now());
  estadoGuardado = signal<'sin-cambios' | 'guardando' | 'guardado'>('sin-cambios');
  estadoEntrega = signal<'respondiendo' | 'entregando' | 'entregado'>('respondiendo');
  errorEntrega = signal<string | null>(null);

  private dialogoEntrega = viewChild<ElementRef<HTMLDialogElement>>('dialogoEntrega');

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

  segundosRestantes = computed(() => {
    const examen = this.examen();
    if (!examen) {
      return 0;
    }
    const milisegundos = Date.parse(examen.fechaLimite) - this.ahora();
    return Math.max(0, Math.floor(milisegundos / 1000));
  });

  tiempoRestante = computed(() => {
    const total = this.segundosRestantes();
    const horas = Math.floor(total / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;
    const mmss = `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
    return horas > 0 ? `${horas}:${mmss}` : mmss;
  });

  tiempoTerminado = computed(() => this.examen() !== null && this.segundosRestantes() === 0);

  resumenEntrega = computed(() =>
    (this.examen()?.preguntas ?? []).map((pregunta, indice) => ({
      id: pregunta.id,
      numero: indice + 1,
      enunciado: pregunta.enunciado,
      respuesta: this.tieneRespuesta(pregunta) ? this.textoRespuesta(pregunta) : null,
    })),
  );

  numerosSinResponder = computed(() =>
    this.resumenEntrega()
      .filter((item) => item.respuesta === null)
      .map((item) => item.numero),
  );

  ngOnInit(): void {
    this.cargarExamen();
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
  }

  // No descuenta de a un segundo: en cada vuelta vuelve a mirar el reloj, así un atraso del intervalo no se acumula
  private iniciarTemporizador(): void {
    if (!isPlatformBrowser(this.plataforma)) {
      return;
    }
    this.detenerTemporizador();
    this.ahora.set(Date.now());
    this.idIntervalo = setInterval(() => {
      this.ahora.set(Date.now());
      if (this.segundosRestantes() === 0) {
        this.detenerTemporizador();
      }
    }, 1000);
  }

  private detenerTemporizador(): void {
    if (this.idIntervalo !== null) {
      clearInterval(this.idIntervalo);
      this.idIntervalo = null;
    }
  }

  cargarExamen(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    this.examenService.obtenerExamen().subscribe({
      next: (examen) => {
        this.examen.set(examen);
        this.cargando.set(false);
        this.iniciarTemporizador();
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

  async guardarRespuesta(valor: Respuesta): Promise<void> {
    const pregunta = this.preguntaActual();
    if (!pregunta) {
      return;
    }
    this.respuestas.update((actuales) => ({ ...actuales, [pregunta.id]: valor }));

    // Si el alumno cambia la respuesta antes de que termine el guardado anterior,
    // solo el último guardado puede mostrar "Guardado"
    this.numeroGuardado++;
    const numeroDeEsteGuardado = this.numeroGuardado;
    this.estadoGuardado.set('guardando');

    await this.examenService.guardarRespuesta(pregunta.id, valor);

    if (numeroDeEsteGuardado === this.numeroGuardado) {
      this.estadoGuardado.set('guardado');
    }
  }

  // El botón Entregar nunca envía: solo abre la confirmación
  abrirConfirmacion(): void {
    this.errorEntrega.set(null);
    this.dialogoEntrega()?.nativeElement.showModal();
  }

  cerrarConfirmacion(): void {
    if (this.estadoEntrega() === 'entregando') {
      return;
    }
    this.dialogoEntrega()?.nativeElement.close();
  }

  // Esc cierra el diálogo por defecto; mientras se entrega no lo dejamos cerrar
  alCancelarDialogo(evento: Event): void {
    if (this.estadoEntrega() === 'entregando') {
      evento.preventDefault();
    }
  }

  async confirmarEntrega(): Promise<void> {
    const examen = this.examen();
    // Si ya se está entregando (doble clic) o ya se entregó, no se vuelve a enviar
    if (!examen || this.estadoEntrega() !== 'respondiendo') {
      return;
    }
    this.estadoEntrega.set('entregando');
    this.errorEntrega.set(null);

    try {
      await this.examenService.entregarExamen(examen.id, this.respuestas());
      this.dialogoEntrega()?.nativeElement.close();
      this.detenerTemporizador();
      this.estadoEntrega.set('entregado');
    } catch {
      this.estadoEntrega.set('respondiendo');
      this.errorEntrega.set('No se pudo entregar el examen. Tus respuestas siguen guardadas, intentá de nuevo.');
    }
  }

  private textoRespuesta(pregunta: Pregunta): string {
    const valor = this.respuestas()[pregunta.id];
    if (pregunta.tipo === 'CHOICE') {
      return pregunta.opciones?.find((opcion) => opcion.id === valor)?.texto ?? String(valor);
    }
    if (pregunta.tipo === 'TRUE_FALSE') {
      return valor ? 'Verdadero' : 'Falso';
    }
    return String(valor).trim();
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