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

    // Estudiantes
    {
        path: 'grupos',
        renderMode: RenderMode.Client
    },
    {
        path: 'examen',
        renderMode: RenderMode.Client
    },

    // Docentes
    {
        path: 'profesor',
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
