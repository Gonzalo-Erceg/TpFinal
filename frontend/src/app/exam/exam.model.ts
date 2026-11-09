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
  // La calcula el backend cuando el alumno empieza el intento. Viene en ISO y UTC (ej. 2026-11-09T18:30:00.000Z)
  fechaLimite: string;
  preguntas: Pregunta[];
}

// CHOICE guarda el id de la opción elegida, TRUE_FALSE un booleano y SHORT_TEXT el texto escrito
export type Respuesta = string | boolean;