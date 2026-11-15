export type TipoPregunta = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'ESSAY' | 'MATCHING' | 'ORDERING' | 'FILE_UPLOAD';

export interface OpcionPregunta {
  id: string;
  contenido: string;
  posicion: number;
  fraccionCredito: number;
}

export interface Pregunta {
  id: string;
  titulo: string | null;
  revisionId: string;
  numeroRevision: number;
  tipo: TipoPregunta;
  enunciado: string;
  opciones: OpcionPregunta[];
  respuestasAceptadas: string[];
  distingueMayusculas: boolean;
}

export interface OpcionNueva {
  contenido: string;
  fraccionCredito: number;
}

export interface DatosPregunta {
  titulo: string;
  tipo: TipoPregunta;
  enunciado: string;
  opciones: OpcionNueva[];
  respuestasAceptadas: string[];
  distingueMayusculas: boolean;
}
