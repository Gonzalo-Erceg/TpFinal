
import { Routes } from '@angular/router';

import { ListaGrupos } from './groups/groups-list';
import { InicioSesion } from './auth/login/login';
import { Registro } from './auth/register/register';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: InicioSesion },
  { path: 'registro', component: Registro },
  { path: 'grupos', component: ListaGrupos },
];
