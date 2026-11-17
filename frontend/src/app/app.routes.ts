
import { Routes } from '@angular/router';

import { PantallaExamen } from './exam/exam-screen';
import { ListaExamenesAlumno } from './exam/available-exams';
import { ListaGrupos } from './groups/groups-list';
import { InicioSesion } from './auth/login/login';
import { Registro } from './auth/register/register';
import { Landing } from './landing/landing';
import { GruposProfesor } from './groups/teacher-groups';
import { BancoPreguntas } from './questions/question-bank';
import { FormularioPregunta } from './questions/question-form';
import { ListaExamenes } from './exams/exams-list';
import { FormularioExamen } from './exams/exam-form';

import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { guestGuard } from './core/auth/guest.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'landing', pathMatch: 'full' },
    { path: 'landing', component: Landing },
    { path: 'login', component: InicioSesion, canActivate: [guestGuard] },
    { path: 'registro', component: Registro, canActivate: [guestGuard] },

    {
        path: 'grupos',
        component: ListaGrupos,
        canActivate: [authGuard, roleGuard],
        data: { role: 'STUDENT' },
    },
    {
        path: 'examenes',
        component: ListaExamenesAlumno,
        canActivate: [authGuard, roleGuard],
        data: { role: 'STUDENT' },
    },
    {
        path: 'examen/:id',
        component: PantallaExamen,
        canActivate: [authGuard, roleGuard],
        data: { role: 'STUDENT' },
    },
    {
        path: 'examen',
        redirectTo: 'examenes',
        pathMatch: 'full',
    },
    {
        path: 'profesor',
        component: GruposProfesor,
        pathMatch: 'full',
        canActivate: [authGuard, roleGuard],
        data: { role: 'TEACHER' },
    },
    {
        path: 'preguntas',
        component: BancoPreguntas,
        canActivate: [authGuard, roleGuard],
        data: { role: 'TEACHER' },
    },
    {
        path: 'preguntas/nueva',
        component: FormularioPregunta,
        canActivate: [authGuard, roleGuard],
        data: { role: 'TEACHER' },
    },
    {
        path: 'preguntas/:id/editar',
        component: FormularioPregunta,
        canActivate: [authGuard, roleGuard],
        data: { role: 'TEACHER' },
    },
    {
        path: 'profesor/examenes',
        component: ListaExamenes,
        pathMatch: 'full',
        canActivate: [authGuard, roleGuard],
        data: { role: 'TEACHER' },
    },
    {
        path: 'profesor/examenes/nuevo',
        component: FormularioExamen,
        canActivate: [authGuard, roleGuard],
        data: { role: 'TEACHER' },
    },
    {
        path: 'profesor/examenes/:id/editar',
        component: FormularioExamen,
        canActivate: [authGuard, roleGuard],
        data: { role: 'TEACHER' },
    },
];
