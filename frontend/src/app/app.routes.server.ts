import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
    {
        path: 'login',
        renderMode: RenderMode.Client
    },
    {
        path: 'registro',
        renderMode: RenderMode.Client
    },

    {
        path: 'grupos',
        renderMode: RenderMode.Client
    },
    {
        path: 'examenes',
        renderMode: RenderMode.Client
    },
    {
        path: 'examen',
        renderMode: RenderMode.Client
    },
    {
        path: 'examen/:id',
        renderMode: RenderMode.Client
    },

    {
        path: 'profesor',
        renderMode: RenderMode.Client
    },
    {
        path: 'profesor/examenes',
        renderMode: RenderMode.Client
    },
    {
        path: 'profesor/examenes/nuevo',
        renderMode: RenderMode.Client
    },
    {
        path: 'profesor/examenes/:id/editar',
        renderMode: RenderMode.Client
    },
    {
        path: 'preguntas',
        renderMode: RenderMode.Client
    },
    {
        path: 'preguntas/nueva',
        renderMode: RenderMode.Client
    },
    {
        path: 'preguntas/:id/editar',
        renderMode: RenderMode.Client
    },
    {
        path: '**',
        renderMode: RenderMode.Prerender
    }
];
