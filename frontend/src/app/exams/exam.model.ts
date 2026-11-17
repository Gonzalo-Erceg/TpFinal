import { TipoPregunta } from '../questions/question.model';

export type EstadoExamen = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CLOSED';
export type EstadoVersionExamen = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type AlcanceIntentos = 'EXAM' | 'VERSION';

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
