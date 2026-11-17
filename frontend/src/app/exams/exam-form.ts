import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { ExamenesService } from './exams.service';
import { DatosExamen, EstadoExamen, ExamenDetalle, ModoLiberacion, PreguntaSeleccionada } from './exam.model';
import { Pregunta, TipoPregunta } from '../questions/question.model';
import { PreguntasService } from '../questions/questions.service';
import { GruposService } from '../groups/groups.service';
import { GrupoDelProfesor } from '../groups/group.model';
import { mensajeDeError } from '../core/api/api-error';

function aDatetimeLocal(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const fecha = new Date(iso);

  if (isNaN(fecha.getTime())) {
    return '';
  }

  const pad = (numero: number) => String(numero).padStart(2, '0');

  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}` +
    `T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;
}

function aIso(datetimeLocal: string): string | null {
  if (!datetimeLocal) {
    return null;
  }

  const fecha = new Date(datetimeLocal);

  return isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

@Component({
  selector: 'app-formulario-examen',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './exam-form.html',
  styleUrl: './exam-form.scss',
})
export class FormularioExamen implements OnInit {
  private examenesService = inject(ExamenesService);
  private preguntasService = inject(PreguntasService);
  private gruposService = inject(GruposService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  examenId = signal<string | null>(null);
  estado = signal<EstadoExamen | null>(null);
  cargando = signal(true);
  guardando = signal(false);
  publicando = signal(false);
  soloLectura = signal(false);
  mensajeError = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  formulario = new FormGroup({
    titulo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    descripcion: new FormControl('', { nonNullable: true }),
    abreEn: new FormControl('', { nonNullable: true }),
    cierraEn: new FormControl('', { nonNullable: true }),
    duracionMinutos: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
    intentosMaximos: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
    modoLiberacion: new FormControl<ModoLiberacion>('MANUAL', { nonNullable: true }),
    mostrarCorrectas: new FormControl(false, { nonNullable: true }),
  });

  preguntasBanco = signal<Pregunta[]>([]);
  grupos = signal<GrupoDelProfesor[]>([]);
  filtroPreguntas = signal('');

  seleccionadas = signal<PreguntaSeleccionada[]>([]);
  gruposSeleccionados = signal<string[]>([]);

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

  etiquetasEstado: Record<EstadoExamen, string> = {
    DRAFT: 'borrador',
    SCHEDULED: 'programado',
    PUBLISHED: 'publicado',
    CLOSED: 'cerrado',
  };

  etiquetaEstado = computed(() => {
    const estado = this.estado();
    return estado ? this.etiquetasEstado[estado] : '';
  });

  preguntasFiltradas = computed(() => {
    const filtro = this.filtroPreguntas().trim().toLowerCase();

    if (!filtro) {
      return this.preguntasBanco();
    }

    return this.preguntasBanco().filter((pregunta) =>
      (pregunta.titulo ?? '').toLowerCase().includes(filtro) ||
      pregunta.enunciado.toLowerCase().includes(filtro)
    );
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    forkJoin({
      preguntas: this.preguntasService.obtenerPreguntas(),
      grupos: this.gruposService.obtenerGruposProfesor(),
      examen: id ? this.examenesService.obtener(id) : of<ExamenDetalle | null>(null),
    }).subscribe({
      next: ({ preguntas, grupos, examen }) => {
        this.preguntasBanco.set(preguntas);
        this.grupos.set(grupos);

        if (examen) {
          this.aplicarExamen(examen);
        }

        this.cargando.set(false);
      },
      error: (error) => {
        this.mensajeError.set(mensajeDeError(error, 'No se pudieron cargar los datos del examen.'));
        this.cargando.set(false);
      },
    });
  }

  private aplicarExamen(examen: ExamenDetalle): void {
    this.examenId.set(examen.id);
    this.estado.set(examen.estado);

    this.formulario.patchValue({
      titulo: examen.titulo,
      descripcion: examen.descripcion ?? '',
      abreEn: aDatetimeLocal(examen.abreEn),
      cierraEn: aDatetimeLocal(examen.cierraEn),
      duracionMinutos: examen.duracionMinutos,
      intentosMaximos: examen.intentosMaximos,
      modoLiberacion: examen.modoLiberacion,
      mostrarCorrectas: examen.mostrarCorrectas,
    });

    this.seleccionadas.set(
      examen.preguntas.map((pregunta) => ({
        preguntaId: pregunta.preguntaId,
        titulo: pregunta.titulo,
        tipo: pregunta.tipo,
        enunciado: pregunta.enunciado,
        puntos: pregunta.puntos,
      }))
    );

    this.gruposSeleccionados.set([...examen.gruposIds]);

    if (examen.estado !== 'DRAFT') {
      this.soloLectura.set(true);
      this.formulario.disable();
    }
  }

  estaPreguntaSeleccionada(preguntaId: string): boolean {
    return this.seleccionadas().some((pregunta) => pregunta.preguntaId === preguntaId);
  }

  alternarPregunta(pregunta: Pregunta): void {
    const actuales = this.seleccionadas();

    if (actuales.some((seleccionada) => seleccionada.preguntaId === pregunta.id)) {
      this.seleccionadas.set(actuales.filter((seleccionada) => seleccionada.preguntaId !== pregunta.id));
      return;
    }

    this.seleccionadas.set([
      ...actuales,
      {
        preguntaId: pregunta.id,
        titulo: pregunta.titulo,
        tipo: pregunta.tipo,
        enunciado: pregunta.enunciado,
        puntos: 1,
      },
    ]);
  }

  quitarPregunta(indice: number): void {
    this.seleccionadas.update((lista) => lista.filter((_, posicion) => posicion !== indice));
  }

  moverPregunta(indice: number, desplazamiento: number): void {
    const destino = indice + desplazamiento;
    const lista = [...this.seleccionadas()];

    if (destino < 0 || destino >= lista.length) {
      return;
    }

    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    this.seleccionadas.set(lista);
  }

  cambiarPuntos(indice: number, evento: Event): void {
    const valor = Number((evento.target as HTMLInputElement).value);

    this.seleccionadas.update((lista) =>
      lista.map((pregunta, posicion) =>
        posicion === indice
          ? { ...pregunta, puntos: Number.isFinite(valor) ? valor : 0 }
          : pregunta
      )
    );
  }

  estaGrupoSeleccionado(grupoId: string): boolean {
    return this.gruposSeleccionados().includes(grupoId);
  }

  cambiarFiltro(evento: Event): void {
    this.filtroPreguntas.set((evento.target as HTMLInputElement).value);
  }

  alternarGrupo(grupoId: string): void {
    const actuales = this.gruposSeleccionados();

    if (actuales.includes(grupoId)) {
      this.gruposSeleccionados.set(actuales.filter((id) => id !== grupoId));
      return;
    }

    this.gruposSeleccionados.set([...actuales, grupoId]);
  }

  guardar(): void {
    const datos = this.construirDatos();

    if (!datos) {
      return;
    }

    const esNuevo = this.examenId() === null;

    this.guardando.set(true);
    this.limpiarMensajes();

    this.guardarExamen$(datos).subscribe({
      next: (examen) => {
        this.guardando.set(false);
        this.examenId.set(examen.id);
        this.estado.set(examen.estado);
        this.mensajeExito.set('Borrador guardado.');

        if (esNuevo) {
          this.router.navigate(['/profesor/examenes', examen.id, 'editar'], { replaceUrl: true });
        }
      },
      error: (error) => {
        this.guardando.set(false);
        this.mensajeError.set(mensajeDeError(error, 'No se pudo guardar el examen.'));
      },
    });
  }

  publicar(): void {
    const datos = this.construirDatos();

    if (!datos) {
      return;
    }

    if (this.seleccionadas().length === 0) {
      this.mensajeError.set('Agregá al menos una pregunta antes de publicar.');
      return;
    }

    if (this.gruposSeleccionados().length === 0) {
      this.mensajeError.set('Asigná al menos un grupo antes de publicar.');
      return;
    }

    this.publicando.set(true);
    this.limpiarMensajes();

    this.guardarExamen$(datos)
      .pipe(switchMap((examen) => this.examenesService.publicar(examen.id)))
      .subscribe({
        next: () => {
          this.publicando.set(false);
          this.router.navigate(['/profesor/examenes']);
        },
        error: (error) => {
          this.publicando.set(false);
          this.mensajeError.set(mensajeDeError(error, 'No se pudo publicar el examen.'));
        },
      });
  }

  private guardarExamen$(datos: DatosExamen): Observable<ExamenDetalle> {
    const id = this.examenId();

    if (id) {
      return this.examenesService.actualizar(id, datos);
    }

    return this.examenesService.crear(datos).pipe(
      switchMap((creado) => {
        this.examenId.set(creado.id);
        return this.examenesService.actualizar(creado.id, datos);
      })
    );
  }

  private construirDatos(): DatosExamen | null {
    this.formulario.markAllAsTouched();

    if (this.formulario.invalid) {
      this.mensajeError.set('Revisá los datos marcados del examen.');
      return null;
    }

    const valor = this.formulario.getRawValue();

    if (valor.abreEn && valor.cierraEn && new Date(valor.abreEn) >= new Date(valor.cierraEn)) {
      this.mensajeError.set('La fecha de apertura debe ser anterior a la de cierre.');
      return null;
    }

    if (this.seleccionadas().some((pregunta) => !Number.isFinite(pregunta.puntos) || pregunta.puntos < 0)) {
      this.mensajeError.set('Los puntos de cada pregunta deben ser un número mayor o igual a 0.');
      return null;
    }

    return {
      titulo: valor.titulo.trim(),
      descripcion: valor.descripcion.trim() || null,
      abreEn: aIso(valor.abreEn),
      cierraEn: aIso(valor.cierraEn),
      duracionMinutos: valor.duracionMinutos,
      intentosMaximos: valor.intentosMaximos,
      modoLiberacion: valor.modoLiberacion,
      mostrarCorrectas: valor.mostrarCorrectas,
      gruposIds: this.gruposSeleccionados(),
      preguntas: this.seleccionadas(),
    };
  }

  private limpiarMensajes(): void {
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
  }
}
