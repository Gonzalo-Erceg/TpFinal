
import { Routes } from '@angular/router';
import { PantallaExamen } from './exam/exam-screen';
import { ListaGrupos } from './groups/groups-list';
import { InicioSesion } from './auth/login/login';
import { Registro } from './auth/register/register';
import { GruposProfesor } from './groups/teacher-groups';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: InicioSesion },
  { path: 'registro', component: Registro },
  { path: 'grupos', component: ListaGrupos },
  { path: 'examen', component: PantallaExamen },
  { path: 'profesor', component: GruposProfesor},
];
