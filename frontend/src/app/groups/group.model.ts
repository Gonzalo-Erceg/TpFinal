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

export type EstadoAlumno = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REMOVED';

export interface Alumno{
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  estado: EstadoAlumno;
  fechaSolicitud: string;
}

export interface GrupoDelProfesor{
  id: string;
  nombre: string;
  materia: string | null;
  codigoDeAcceso: string;
}