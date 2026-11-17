export type TipoPregunta =
  | 'CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_TEXT'
  | 'ESSAY'
  | 'NO_SOPORTADO';

export interface OpcionPregunta {
  id: string;
  texto: string;
  posicion: number;
}

export interface Pregunta {
  id: string;
  tipo: TipoPregunta;
  enunciado: string;
  puntaje: number;
  posicion: number;
  opciones?: OpcionPregunta[];
}

export type Respuesta = string | string[];

export interface ExamenDisponible {
  id: string;
  titulo: string;
  descripcion: string | null;
  grupo: string | null;
  estado: string;
  abreEn: string | null;
  cierraEn: string | null;
  duracionMinutos: number | null;
  intentosUsados: number;
  intentosMaximos: number | null;
  intentoEnCurso: boolean;
  cantidadPreguntas: number;
  puntajeTotal: number;
  puedeIniciar: boolean;
}

export interface Examen {
  id: string;
  titulo: string;
  descripcion: string | null;
  grupo: string | null;
  duracionMinutos: number | null;
  cierraEn: string | null;
  intentoId: string;
  fechaLimite: string;
  intentosUsados: number;
  intentosMaximos: number | null;
  preguntas: Pregunta[];
  respuestas: Record<string, Respuesta>;
}

export interface IntentoExamen {
  intentoId: string;
  fechaLimite: string;
  creado: boolean;
}
