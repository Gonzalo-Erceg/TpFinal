import { Routes } from '@angular/router';
import { InicioSesion } from './auth/login/login';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: InicioSesion },
];