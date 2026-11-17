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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExamenService } from './exam.service';
import { Examen, ExamenDisponible, Pregunta, Respuesta, TipoPregunta } from './exam.model';
import { mensajeDeError } from '../core/api/api-error';
import { RespuestaChoice } from './choice-answer';
import { RespuestaTrueFalse } from './true-false-answer';
import { LIMITE_CARACTERES, LIMITE_DESARROLLO, RespuestaShortText } from './short-text-answer';

const SEGUNDOS_PARA_VOLVER = 10;
const MINIMO_AVISO_ENTREGA_MS = 3000;

@Component({
  selector: 'app-pantalla-examen',
  imports: [RespuestaChoice, RespuestaTrueFalse, RespuestaShortText, RouterLink],
  templateUrl: './exam-screen.html',
  styleUrl: './exam-screen.scss',
})
export class PantallaExamen implements OnInit, OnDestroy {
  private examenService = inject(ExamenService);
  private ruta = inject(ActivatedRoute);
  private plataforma = inject(PLATFORM_ID);
  private documento = inject(DOCUMENT);
  private idIntervalo: ReturnType<typeof setInterval> | null = null;

  private numeroGuardado = 0;
  private idExamen = '';
  private temporizadoresTexto = new Map<string, ReturnType<typeof setTimeout>>();
  private respuestasPendientes = new Map<string, { pregunta: Pregunta; valor: Respuesta; numero: number }>();

  ahora = signal(Date.now());
  disponible = signal<ExamenDisponible | null>(null);
  examen = signal<Examen | null>(null);
  intentoEnCurso = signal(false);
  fechaLimite = signal<string | null>(null);
  estadoGuardado = signal<'sin-cambios' | 'guardando' | 'guardado' | 'error'>('sin-cambios');
  estadoExamen = signal<
    'instrucciones' | 'comenzando' | 'respondiendo' | 'fuera-de-pantalla' | 'entregando' | 'entregado'
  >('instrucciones');
  errorInicio = signal<string | null>(null);
  errorEntrega = signal<string | null>(null);
  errorGuardado = signal<string | null>(null);
  errorVolver = signal<string | null>(null);
  salioDePantallaCompleta = signal(false);
  limiteParaVolver = signal<number | null>(null);

  segundosParaVolverTotal = SEGUNDOS_PARA_VOLVER;

  segundosParaVolver = computed(() => {
    const limite = this.limiteParaVolver();
    return limite === null ? 0 : Math.max(0, Math.ceil((limite - this.ahora()) / 1000));
  });

  private dialogoEntrega = viewChild<ElementRef<HTMLDialogElement>>('dialogoEntrega');

  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  indiceActual = signal(0);
  respuestas = signal<Record<string, Respuesta>>({});

  limiteTextoCorto = LIMITE_CARACTERES;
  limiteDesarrollo = LIMITE_DESARROLLO;

  etiquetasTipo: Record<TipoPregunta, string> = {
    CHOICE: 'Opción única',
    MULTIPLE_CHOICE: 'Opción múltiple',
    TRUE_FALSE: 'Verdadero o falso',
    SHORT_TEXT: 'Respuesta corta',
    ESSAY: 'Desarrollo',
    NO_SOPORTADO: 'Tipo no disponible',
  };

  private tiposSoportados: TipoPregunta[] = ['CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_TEXT'];

  titulo = computed(() => this.examen()?.titulo ?? this.disponible()?.titulo ?? '');
  grupo = computed(() => this.examen()?.grupo ?? this.disponible()?.grupo ?? null);
  duracionMinutos = computed(
    () => this.examen()?.duracionMinutos ?? this.disponible()?.duracionMinutos ?? null,
  );

  etiquetaDuracion = computed(() => {
    const duracion = this.duracionMinutos();

    if (duracion !== null) {
      return `${duracion} min`;
    }

    if (this.examen()?.cierraEn ?? this.disponible()?.cierraEn) {
      return 'Hasta el cierre';
    }

    return 'Sin límite';
  });

  totalPreguntas = computed(
    () => this.examen()?.preguntas.length ?? this.disponible()?.cantidadPreguntas ?? 0,
  );

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

  puntajeTotal = computed(() => {
    const examen = this.examen();

    if (examen) {
      return examen.preguntas.reduce((total, pregunta) => total + pregunta.puntaje, 0);
    }

    return this.disponible()?.puntajeTotal ?? 0;
  });

  tiposDelExamen = computed(() => {
    const tipos = (this.examen()?.preguntas ?? []).map((pregunta) => pregunta.tipo);

    if (tipos.length === 0) {
      return this.tiposSoportados;
    }

    return tipos.filter((tipo, indice) => tipos.indexOf(tipo) === indice && tipo !== 'NO_SOPORTADO');
  });

  puedeIniciar = computed(() => this.intentoEnCurso() || (this.disponible()?.puedeIniciar ?? false));

  motivoNoInicia = computed(() => {
    const disponible = this.disponible();

    if (!disponible || this.puedeIniciar()) {
      return null;
    }

    if (disponible.duracionMinutos === null && disponible.cierraEn === null) {
      return 'El docente no configuró una duración ni una fecha de cierre para este examen.';
    }

    return 'No te quedan intentos disponibles para este examen.';
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
    this.idExamen = this.ruta.snapshot.paramMap.get('id') ?? '';
    this.cargar();
  }

  ngOnDestroy(): void {
    this.detenerTemporizador();
    for (const temporizador of this.temporizadoresTexto.values()) {
      clearTimeout(temporizador);
    }
    this.temporizadoresTexto.clear();
    this.documento.removeEventListener('fullscreenchange', this.alCambiarPantallaCompleta);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.mensajeError.set(null);

    if (!this.idExamen) {
      this.mensajeError.set('No se indicó qué examen querés rendir.');
      this.cargando.set(false);
      return;
    }

    try {
      const disponibles = await firstValueFrom(this.examenService.listarDisponibles());
      const disponible = disponibles.find((examen) => examen.id === this.idExamen) ?? null;

      if (!disponible) {
        this.mensajeError.set('El examen no existe o no está disponible para vos.');
        this.cargando.set(false);
        return;
      }

      this.disponible.set(disponible);

      const examen = await firstValueFrom(this.examenService.obtenerExamen(this.idExamen));

      if (examen) {
        this.aplicarExamen(examen);
        this.intentoEnCurso.set(true);
      }

      this.cargando.set(false);
    } catch (error) {
      this.mensajeError.set(mensajeDeError(error, 'No se pudo cargar el examen. Intentá de nuevo.'));
      this.cargando.set(false);
    }
  }

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
      if (this.segundosRestantes() === 0 && !afuera && this.estadoExamen() === 'respondiendo') {
        this.detenerTemporizador();
        this.entregar(true);
      }
    }, 250);
  }

  private detenerTemporizador(): void {
    if (this.idIntervalo !== null) {
      clearInterval(this.idIntervalo);
      this.idIntervalo = null;
    }
  }

  private aplicarExamen(examen: Examen): void {
    this.examen.set({ ...examen, grupo: this.disponible()?.grupo ?? examen.grupo });
    this.fechaLimite.set(examen.fechaLimite);
    this.respuestas.set({ ...examen.respuestas });
    this.indiceActual.set(0);
  }

  async comenzarExamen(): Promise<void> {
    if (!this.idExamen || this.estadoExamen() !== 'instrucciones') {
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
      const intento = await firstValueFrom(this.examenService.iniciarIntento(this.idExamen));

      if (!this.documento.fullscreenElement) {
        this.estadoExamen.set('instrucciones');
        this.errorInicio.set('Saliste de la pantalla completa antes de empezar. Probá de nuevo.');
        return;
      }

      const examen = await firstValueFrom(this.examenService.obtenerExamenActual(this.idExamen));

      this.aplicarExamen(examen);
      this.fechaLimite.set(intento.fechaLimite || examen.fechaLimite);
      this.intentoEnCurso.set(true);
      this.documento.addEventListener('fullscreenchange', this.alCambiarPantallaCompleta);
      this.estadoExamen.set('respondiendo');
      this.iniciarTemporizador();
    } catch (error) {
      this.salirDePantallaCompleta();
      this.estadoExamen.set('instrucciones');
      this.errorInicio.set(mensajeDeError(error, 'No se pudo iniciar el examen. Intentá de nuevo.'));
    }
  }

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
    const examen = this.examen();

    if (!pregunta || !examen) {
      return;
    }

    this.respuestas.update((actuales) => ({ ...actuales, [pregunta.id]: valor }));

    this.numeroGuardado++;
    const numeroDeEsteGuardado = this.numeroGuardado;
    this.errorGuardado.set(null);
    this.estadoGuardado.set('guardando');

    if (this.esRespuestaDeTexto(pregunta.tipo)) {
      this.programarGuardadoDeTexto(pregunta, valor, numeroDeEsteGuardado);
      return;
    }

    await this.enviarRespuesta(examen.intentoId, pregunta, valor, numeroDeEsteGuardado);
  }

  private programarGuardadoDeTexto(pregunta: Pregunta, valor: Respuesta, numero: number): void {
    this.respuestasPendientes.set(pregunta.id, { pregunta, valor, numero });

    const anterior = this.temporizadoresTexto.get(pregunta.id);

    if (anterior) {
      clearTimeout(anterior);
    }

    this.temporizadoresTexto.set(
      pregunta.id,
      setTimeout(() => {
        this.temporizadoresTexto.delete(pregunta.id);
        const examen = this.examen();

        if (examen) {
          void this.enviarRespuesta(examen.intentoId, pregunta, valor, numero);
        }
      }, 500),
    );
  }

  private async enviarRespuesta(
    intentoId: string,
    pregunta: Pregunta,
    valor: Respuesta,
    numero: number,
  ): Promise<boolean> {
    if (this.respuestasPendientes.get(pregunta.id)?.numero === numero) {
      this.respuestasPendientes.delete(pregunta.id);
    }

    try {
      await firstValueFrom(this.examenService.guardarRespuesta(intentoId, pregunta, valor));

      if (numero === this.numeroGuardado) {
        this.estadoGuardado.set('guardado');
      }

      return true;
    } catch (error) {
      if (numero === this.numeroGuardado) {
        this.estadoGuardado.set('error');
        this.errorGuardado.set(
          mensajeDeError(error, 'No se pudo guardar la respuesta. Revisá tu conexión e intentá de nuevo.'),
        );
      }

      return false;
    }
  }

  private async vaciarRespuestasPendientes(intentoId: string): Promise<void> {
    for (let vuelta = 0; vuelta < 5 && this.respuestasPendientes.size > 0; vuelta++) {
      const pendientes = [...this.respuestasPendientes.values()];

      for (const pendiente of pendientes) {
        const actual = this.respuestasPendientes.get(pendiente.pregunta.id);

        if (actual?.numero !== pendiente.numero) {
          continue;
        }

        this.respuestasPendientes.delete(pendiente.pregunta.id);

        const temporizador = this.temporizadoresTexto.get(pendiente.pregunta.id);

        if (temporizador) {
          clearTimeout(temporizador);
          this.temporizadoresTexto.delete(pendiente.pregunta.id);
        }

        await firstValueFrom(
          this.examenService.guardarRespuesta(intentoId, pendiente.pregunta, pendiente.valor),
        );
      }
    }
  }

  private esRespuestaDeTexto(tipo: TipoPregunta): boolean {
    return tipo === 'SHORT_TEXT' || tipo === 'ESSAY';
  }

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

  alCancelarDialogo(evento: Event): void {
    if (this.estadoExamen() === 'entregando') {
      evento.preventDefault();
    }
  }

  confirmarEntrega(): void {
    this.entregar();
  }

  reintentarEntrega(): void {
    this.entregar(true);
  }

  private async entregar(automatica = false): Promise<void> {
    const examen = this.examen();
    const estado = this.estadoExamen();
    if (!examen || (estado !== 'respondiendo' && estado !== 'fuera-de-pantalla')) {
      return;
    }
    this.estadoExamen.set('entregando');
    this.errorEntrega.set(null);
    const estabaFuera = estado === 'fuera-de-pantalla';

    try {
      await this.vaciarRespuestasPendientes(examen.intentoId);
      const envio = firstValueFrom(this.examenService.entregarExamen(examen.intentoId));
      const espera = automatica ? this.esperar(MINIMO_AVISO_ENTREGA_MS) : Promise.resolve();
      await Promise.all([envio, espera]);
      this.dialogoEntrega()?.nativeElement.close();
      this.detenerTemporizador();
      this.documento.removeEventListener('fullscreenchange', this.alCambiarPantallaCompleta);
      this.salirDePantallaCompleta();
      this.estadoExamen.set('entregado');
    } catch (error) {
      this.estadoExamen.set(estabaFuera ? 'fuera-de-pantalla' : 'respondiendo');
      this.errorEntrega.set(
        mensajeDeError(error, 'No se pudo entregar el examen. Tus respuestas siguen guardadas, intentá de nuevo.'),
      );
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

    if (Array.isArray(valor)) {
      const textos = valor
        .map((id) => pregunta.opciones?.find((opcion) => opcion.id === id)?.texto)
        .filter((texto): texto is string => Boolean(texto));

      return textos.join(', ');
    }

    if (typeof valor === 'string') {
      if (pregunta.tipo === 'CHOICE' || pregunta.tipo === 'TRUE_FALSE') {
        return pregunta.opciones?.find((opcion) => opcion.id === valor)?.texto ?? valor;
      }

      return valor.trim();
    }

    return '';
  }

  private tieneRespuesta(pregunta: Pregunta): boolean {
    const valor = this.respuestas()[pregunta.id];

    if (Array.isArray(valor)) {
      return valor.length > 0;
    }

    if (typeof valor === 'string') {
      return valor.trim().length > 0;
    }

    return false;
  }
}
