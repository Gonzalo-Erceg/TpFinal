export type RolUsuario = 'STUDENT' | 'TEACHER';


export interface UsuarioPublico {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
}

export interface DatosRegistro {
  nombre: string;
  apellido: string;
  email: string;
  contrasena: string;
  rol: RolUsuario;
}