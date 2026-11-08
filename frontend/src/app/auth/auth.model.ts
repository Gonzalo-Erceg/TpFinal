export type RolUsuario = 'STUDENT' | 'TEACHER';


export interface UsuarioPublico {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
}