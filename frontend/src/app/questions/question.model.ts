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
    numeroRevision : number;
    tipo : TipoPregunta;
    enunciado: string;
    opciones : OpcionPregunta[];
}
