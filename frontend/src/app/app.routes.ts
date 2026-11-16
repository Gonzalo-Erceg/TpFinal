
import { Routes } from '@angular/router';
import { PantallaExamen } from './exam/exam-screen';
import { ListaGrupos } from './groups/groups-list';
import { InicioSesion } from './auth/login/login';
import { Registro } from './auth/register/register';
import { Landing } from './landing/landing';
import { GruposProfesor } from './groups/teacher-groups';
import { BancoPreguntas } from './questions/question-bank';
import { FormularioPregunta } from './questions/question-form';

export const routes: Routes = [
  { path: '', redirectTo: 'landing', pathMatch: 'full' },
  { path: 'landing', component: Landing },
  { path: 'login', component: InicioSesion },
  { path: 'registro', component: Registro },
  { path: 'grupos', component: ListaGrupos },
  { path: 'examen', component: PantallaExamen },
  { path: 'profesor', component: GruposProfesor },
  { path: 'preguntas', component: BancoPreguntas },
  { path: 'preguntas/nueva', component: FormularioPregunta },
  { path: 'preguntas/:id/editar', component: FormularioPregunta },
];
