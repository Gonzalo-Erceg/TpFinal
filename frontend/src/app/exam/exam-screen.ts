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
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ExamenService } from './exam.service';
import { Examen, Pregunta, Respuesta, TipoPregunta } from './exam.model';
import { RespuestaChoice } from './choice-answer';
import { RespuestaTrueFalse } from './true-false-answer';
import { LIMITE_CARACTERES, RespuestaShortText } from './short-text-answer';

// Margen por si el alumno apretó Esc sin querer
const SEGUNDOS_PARA_VOLVER = 10;
// Tiempo mínimo que se ve el aviso de entrega automática, para que se llegue a leer
const MINIMO_AVISO_ENTREGA_MS = 3000;

@Component({
  selector: 'app-pantalla-examen',
  imports: [RespuestaChoice, RespuestaTrueFalse, RespuestaShortText],
  templateUrl: './exam-screen.html',
  styleUrl: './exam-screen.scss',
})
export class PantallaExamen implements OnInit, OnDestroy {
  private examenService = inject(ExamenService);
  private plataforma = inject(PLATFORM_ID);
  private documento = inject(DOCUMENT);
  private idIntervalo: ReturnType<typeof setInterval> | null = null;

  private numeroGuardado = 0;

  ahora = signal(Date.now());
  fechaLimite = signal<string | null>(null);
  estadoGuardado = signal<'sin-cambios' | 'guardando' | 'guardado'>('sin-cambios');
  estadoExamen = signal<
    'instrucciones' | 'comenzando' | 'respondiendo' | 'fuera-de-pantalla' | 'entregando' | 'entregado'
  >('instrucciones');
  errorInicio = signal<string | null>(null);
  errorEntrega = signal<string | null>(null);
  errorVolver = signal<string | null>(null);
  salioDePantallaCompleta = signal(false);
  // Momento (en ms) en que se termina el margen para volver a pantalla completa
  limiteParaVolver = signal<number | null>(null);

  segundosParaVolverTotal = SEGUNDOS_PARA_VOLVER;

  // Igual que el timer del examen: se calcula contra el reloj, no se descuenta
  segundosParaVolver = computed(() => {
    const limite = this.limiteParaVolver();
    return limite === null ? 0 : Math.max(0, Math.ceil((limite - this.ahora()) / 1000));
  });

  private dialogoEntrega = viewChild<ElementRef<HTMLDialogElement>>('dialogoEntrega');

  examen = signal<Examen | null>(null);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  indiceActual = signal(0);
  respuestas = signal<Record<number, Respuesta>>({});

  limiteTextoCorto = LIMITE_CARACTERES;

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

  enInstrucciones = computed(() => this.estadoExamen() === 'instrucciones' || this.estadoExamen() === 'comenzando');

  puntajeTotal = computed(() =>
    (this.examen()?.preguntas ?? []).reduce((total, pregunta) => total + pregunta.puntaje, 0),
  );

  // Solo los tipos que aparecen en este examen, sin repetir
  tiposDelExamen = computed(() => {
    const tipos = (this.examen()?.preguntas ?? []).map((pregunta) => pregunta.tipo);
    return tipos.filter((tipo, indice) => tipos.indexOf(tipo) === indice);
  });

  segundosRestantes = computed(() => {
    const fechaLimite = this.fechaLimite();
    if (!fechaLimite) {
      return 0;
    }
    const milisegundos = Date.parse(fechaLimite) - this.ahora();
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

  tiempoTerminado = computed(() => this.fechaLimite() !== null && this.segundosRestantes() === 0);

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
    this.documento.removeEventListener('fullscreenchange', this.alCambiarPantallaCompleta);
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
      const afuera = this.estadoExamen() === 'fuera-de-pantalla';
      if (afuera && this.segundosParaVolver() === 0) {
        this.entregarPorSalida();
      }
      if (this.segundosRestantes() === 0 && !afuera) {
        this.detenerTemporizador();
      }
      // Mira el reloj 4 veces por segundo para que el número cambie justo a tiempo y no saltee ninguno
    }, 250);
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
      },
      error: () => {
        this.mensajeError.set('No se pudo cargar el examen. Intentá de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  // El navegador solo deja entrar a pantalla completa como respuesta a un clic, por eso va en el botón Comenzar
  async comenzarExamen(): Promise<void> {
    const examen = this.examen();
    if (!examen || this.estadoExamen() !== 'instrucciones') {
      return;
    }
    this.estadoExamen.set('comenzando');
    this.errorInicio.set(null);

    try {
      await this.documento.documentElement.requestFullscreen();
    } catch {
      this.estadoExamen.set('instrucciones');
      this.errorInicio.set('Para rendir tenés que permitir la pantalla completa. Probá de nuevo.');
      return;
    }

    try {
      const intento = await this.examenService.iniciarIntento(examen.id);
      // Si salió de pantalla completa mientras se iniciaba, no arranca
      if (!this.documento.fullscreenElement) {
        this.estadoExamen.set('instrucciones');
        this.errorInicio.set('Saliste de la pantalla completa antes de empezar. Probá de nuevo.');
        return;
      }
      this.fechaLimite.set(intento.fechaLimite);
      this.documento.addEventListener('fullscreenchange', this.alCambiarPantallaCompleta);
      this.estadoExamen.set('respondiendo');
      this.iniciarTemporizador();
    } catch {
      this.salirDePantallaCompleta();
      this.estadoExamen.set('instrucciones');
      this.errorInicio.set('No se pudo iniciar el examen. Intentá de nuevo.');
    }
  }

  // Es una función flecha guardada en una propiedad para poder sacar el mismo listener después
  private alCambiarPantallaCompleta = (): void => {
    const enPantallaCompleta = this.documento.fullscreenElement !== null;

    if (!enPantallaCompleta && this.estadoExamen() === 'respondiendo') {
      this.dialogoEntrega()?.nativeElement.close();
      this.errorVolver.set(null);
      this.ahora.set(Date.now());
      this.limiteParaVolver.set(Date.now() + SEGUNDOS_PARA_VOLVER * 1000);
      this.estadoExamen.set('fuera-de-pantalla');
    } else if (enPantallaCompleta && this.estadoExamen() === 'fuera-de-pantalla') {
      this.limiteParaVolver.set(null);
      this.estadoExamen.set('respondiendo');
    }
  };

  // Tiene que ser un clic del alumno: el navegador no deja volver a pantalla completa solo
  async volverAPantallaCompleta(): Promise<void> {
    this.errorVolver.set(null);
    try {
      await this.documento.documentElement.requestFullscreen();
    } catch {
      this.errorVolver.set('No se pudo volver a pantalla completa. Probá de nuevo.');
    }
  }

  private entregarPorSalida(): void {
    this.limiteParaVolver.set(null);
    this.salioDePantallaCompleta.set(true);
    this.entregar(true);
  }

  private salirDePantallaCompleta(): void {
    if (this.documento.fullscreenElement) {
      this.documento.exitFullscreen();
    }
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
    if (this.estadoExamen() === 'entregando') {
      return;
    }
    this.dialogoEntrega()?.nativeElement.close();
  }

  // Esc cierra el diálogo por defecto; mientras se entrega no lo dejamos cerrar
  alCancelarDialogo(evento: Event): void {
    if (this.estadoExamen() === 'entregando') {
      evento.preventDefault();
    }
  }

  confirmarEntrega(): void {
    this.entregar();
  }

  // Lo usa la pantalla de "saliste de pantalla completa" si el envío automático falla
  reintentarEntrega(): void {
    this.entregar(true);
  }

  private async entregar(automatica = false): Promise<void> {
    const examen = this.examen();
    const estado = this.estadoExamen();
    // Si ya se está entregando (doble clic) o ya se entregó, no se vuelve a enviar
    if (!examen || (estado !== 'respondiendo' && estado !== 'fuera-de-pantalla')) {
      return;
    }
    this.estadoExamen.set('entregando');
    this.errorEntrega.set(null);

    try {
      const envio = this.examenService.entregarExamen(examen.id, this.respuestas());
      // En la entrega automática se espera también un mínimo, así el aviso se llega a leer
      const espera = automatica ? this.esperar(MINIMO_AVISO_ENTREGA_MS) : Promise.resolve();
      await Promise.all([envio, espera]);
      this.dialogoEntrega()?.nativeElement.close();
      this.detenerTemporizador();
      // Primero se saca el listener, así salir de pantalla completa acá no se toma como una salida del alumno
      this.documento.removeEventListener('fullscreenchange', this.alCambiarPantallaCompleta);
      this.salirDePantallaCompleta();
      this.estadoExamen.set('entregado');
    } catch {
      this.estadoExamen.set('respondiendo');
      this.errorEntrega.set('No se pudo entregar el examen. Tus respuestas siguen guardadas, intentá de nuevo.');
      // Si falló una entrega manual y mientras tanto salió de pantalla completa, no puede seguir respondiendo
      if (!this.documento.fullscreenElement) {
        this.salioDePantallaCompleta.set(true);
      }
    }
  }

  private esperar(milisegundos: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milisegundos));
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