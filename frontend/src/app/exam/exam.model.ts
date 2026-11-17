export type TipoPregunta = 'CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT';

export interface OpcionPregunta {
  id: string;
  texto: string;
}

export interface Pregunta {
  id: number;
  tipo: TipoPregunta;
  enunciado: string;
  puntaje: number;
  opciones?: OpcionPregunta[];
}

export interface Examen {
  id: number;
  titulo: string;
  materia: string;
  duracionMinutos: number;
  preguntas: Pregunta[];
}

export interface IntentoExamen {
  fechaLimite: string;
}

export type Respuesta = string | boolean;