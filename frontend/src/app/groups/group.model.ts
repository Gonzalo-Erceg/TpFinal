export type EstadoMembresia = 'PENDING' | 'ACTIVE' | 'REJECTED';

export interface Grupo {
  id: number;
  nombre: string;
  materia: string;
  profesor: string;
  estadoMembresia: EstadoMembresia;
}

export interface SolicitudUnirseGrupo {
  codigo: string;
}