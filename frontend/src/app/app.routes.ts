import { Routes } from '@angular/router';

import { PantallaExamen } from './exam/exam-screen';
import { ListaGrupos } from './groups/groups-list';
import { InicioSesion } from './auth/login/login';
import { Registro } from './auth/register/register';

import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
  // TODO: reemplazar por la home pública cuando se implemente la issue #20.
    { 
        path: '', redirectTo: 'login', pathMatch: 'full' 
    },
    { 
        path: 'login', 
        component: InicioSesion, 
        canActivate: [guestGuard] 
    },
    { 
        path: 'registro', 
        component: Registro, 
        canActivate: [guestGuard] 
    },
    {
        path: 'grupos',
        component: ListaGrupos,
        canActivate: [authGuard, roleGuard],
        data: { role: 'STUDENT' }
    },

    {
        path: 'examen',
        component: PantallaExamen,
        canActivate: [authGuard, roleGuard],
        data: { role: 'STUDENT' }
    },
];