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

export type EstadoIntento = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADING' | 'GRADED' | 'CANCELLED';

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
  ultimoIntentoId: string | null;
  ultimoIntentoEstado: EstadoIntento | null;
  ultimoPuntaje: number | null;
  ultimoPuntajeMaximo: number | null;
  resultadoDisponible: boolean;
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

export interface EntregaExamen {
  intentoId: string;
  estado: EstadoIntento;
  entregadoEn: string | null;
  resultadoDisponible: boolean;
}

export interface OpcionResultado {
  id: string;
  texto: string;
  posicion: number;
  seleccionada: boolean;
}

export interface RespuestaResultado {
  id: string;
  posicion: number;
  tipo: TipoPregunta;
  enunciado: string;
  puntosObtenidos: number | null;
  puntosMaximos: number;
  correcta: boolean;
  respuestaTexto: string | null;
  opcionesSeleccionadas: string[];
  opcionesCorrectas: string[];
  opciones: OpcionResultado[];
}

export interface ResultadoExamen {
  intentoId: string;
  examenId: string;
  estado: EstadoIntento;
  puntajeTotal: number | null;
  puntajeMaximo: number | null;
  porcentaje: number | null;
  mostrarCorrectas: boolean;
  entregadoEn: string | null;
  corregidoEn: string | null;
  respuestas: RespuestaResultado[];
}
