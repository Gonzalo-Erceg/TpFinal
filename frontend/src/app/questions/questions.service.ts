import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TipoPregunta, OpcionPregunta, Pregunta } from './question.model';

// Forma en que el backend devuelve una opción (campos en inglés)
interface OpcionPreguntaApi {
  id: string;
  content: string;
  position: number;
  creditFraction: number;
}

// Forma en que el backend devuelve una pregunta (con la revisión anidada)
interface PreguntaApi {
  id: string;
  title: string | null;
  revision: {
    id: string;
    number: number;
    type: TipoPregunta;
    statement: string;
    options: OpcionPreguntaApi[];
  };
}

@Injectable({ providedIn: 'root' })
export class PreguntasService {
  private http = inject(HttpClient);

  // Equivale a GET /questions
  obtenerPreguntas(tipo?: TipoPregunta): Observable<Pregunta[]> {
    const params: Record<string, string> = tipo ? { type: tipo } : {};
    return this.http
      .get<PreguntaApi[]>('/questions', { params })
      .pipe(map((lista) => lista.map((preguntaApi) => this.aPregunta(preguntaApi))));

  }

  eliminarPregunta(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/questions/${id}`);
  }

  // Traduce una opción del backend (inglés) al modelo del front (español)
  private aOpcion(opcionApi: OpcionPreguntaApi): OpcionPregunta {
    return {
      id: opcionApi.id,
      contenido: opcionApi.content,
      posicion: opcionApi.position,
      fraccionCredito: opcionApi.creditFraction,
    };
  }

  // Traduce una pregunta del backend al modelo del front, "aplanando" la revisión
  private aPregunta(preguntaApi: PreguntaApi): Pregunta {
    return {
      id: preguntaApi.id,
      titulo: preguntaApi.title,
      revisionId: preguntaApi.revision.id,
      numeroRevision: preguntaApi.revision.number,
      tipo: preguntaApi.revision.type,
      enunciado: preguntaApi.revision.statement,
      opciones: preguntaApi.revision.options.map((opcionApi) => this.aOpcion(opcionApi)),
    };
  }
}