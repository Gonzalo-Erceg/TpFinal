import { TipoPregunta } from '../questions/question.model';
import { EstadoIntento } from '../exam/exam.model';

export type EstadoExamen = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CLOSED';
export type EstadoVersionExamen = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AlcanceIntentos = 'EXAM' | 'VERSION';
export type ModoLiberacion = 'IMMEDIATE' | 'ON_CLOSE' | 'MANUAL';

export interface ExamenResumen {
  id: string;
  titulo: string;
  descripcion: string | null;
  estado: EstadoExamen;
  versionActualId: string | null;
  estadoVersionActual: EstadoVersionExamen | null;
  publicaEn: string | null;
  abreEn: string | null;
  cierraEn: string | null;
  duracionMinutos: number | null;
  intentosMaximos: number | null;
  alcanceIntentos: AlcanceIntentos;
  gruposIds: string[];
  cantidadPreguntas: number;
  cantidadIntentos: number;
  modoLiberacion: ModoLiberacion;
  liberadoEn: string | null;
  mostrarCorrectas: boolean;
  creadoEn: string | null;
  actualizadoEn: string | null;
}

export interface GrupoDeExamen {
  id: string;
  nombre: string;
  codigoDeAcceso: string;
}

export interface PreguntaDeExamen {
  idExamenVersionPregunta: string;
  preguntaId: string;
  revisionId: string;
  titulo: string | null;
  tipo: TipoPregunta;
  enunciado: string;
  posicion: number;
  puntos: number;
}

export interface ExamenDetalle extends ExamenResumen {
  numeroVersionActual: number | null;
  grupos: GrupoDeExamen[];
  preguntas: PreguntaDeExamen[];
}

export interface PreguntaSeleccionada {
  preguntaId: string;
  titulo: string | null;
  tipo: TipoPregunta;
  enunciado: string;
  puntos: number;
}

export interface DatosExamen {
  titulo: string;
  descripcion: string | null;
  abreEn: string | null;
  cierraEn: string | null;
  duracionMinutos: number | null;
  intentosMaximos: number | null;
  modoLiberacion: ModoLiberacion;
  mostrarCorrectas: boolean;
  gruposIds?: string[];
  preguntas?: PreguntaSeleccionada[];
}

export interface ExamenCreado {
  id: string;
  currentVersionId: string;
  status: EstadoExamen;
}

export interface ExamenPublicado {
  id: string;
  status: EstadoExamen;
  publishedVersionId: string;
  publishedAt: string | null;
}

export interface ExamenCerrado {
  id: string;
  status: EstadoExamen;
}

export interface LiberacionResultados {
  id: string;
  estado: EstadoExamen;
  modoLiberacion: ModoLiberacion;
  liberadoEn: string | null;
}

export interface IntentoExamenResumen {
  intentoId: string;
  estudianteId: string;
  estudianteNombre: string;
  estudianteEmail: string;
  numeroIntento: number;
  estado: EstadoIntento;
  iniciadoEn: string | null;
  entregadoEn: string | null;
  puntajeTotal: number | null;
  puntajeMaximo: number | null;
  corregidoEn: string | null;
}

export type EstadoCorreccion = 'PENDING' | 'AUTO_GRADED' | 'MANUAL_REVIEW' | 'GRADED';
export type MetodoCorreccion = 'AUTOMATIC' | 'MANUAL';

export interface PreguntaRevision {
  idExamenVersionPregunta: string;
  posicion: number;
  tipo: TipoPregunta;
  enunciado: string;
  puntos: number;
  textoRespuesta: string | null;
  estadoCorreccion: EstadoCorreccion | null;
  puntosObtenidos: number | null;
  metodoCorreccion: MetodoCorreccion | null;
  necesitaRevision: boolean;
  editable: boolean;
}

export interface RevisionIntento {
  intentoId: string;
  examenId: string;
  tituloExamen: string;
  estudianteId: string;
  estudianteNombre: string;
  estudianteEmail: string;
  numeroIntento: number;
  estado: EstadoIntento;
  entregadoEn: string | null;
  puntajeTotal: number | null;
  puntajeMaximo: number | null;
  corregidoEn: string | null;
  cantidadPendientes: number;
  preguntas: PreguntaRevision[];
}

export interface CalificacionManual {
  idExamenVersionPregunta: string;
  puntosObtenidos: number;
}

export interface RevisionGuardada {
  intentoId: string;
  estado: EstadoIntento;
  puntajeTotal: number | null;
  puntajeMaximo: number | null;
  corregidoEn: string | null;
}
