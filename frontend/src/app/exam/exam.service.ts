import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import {
  Examen,
  ExamenDisponible,
  IntentoExamen,
  OpcionPregunta,
  Pregunta,
  Respuesta,
  TipoPregunta,
} from './exam.model';

interface ExamenDisponibleApi {
  id: string;
  title: string;
  description: string | null;
  groupName: string | null;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  durationMinutes: number | null;
  attemptsUsed: number;
  maxAttempts: number | null;
  hasInProgress: boolean;
  questionCount: number;
  totalPoints: number;
  canStart: boolean;
}

interface OpcionApi {
  id: string;
  content: string;
  position: number;
}

interface PreguntaApi {
  examVersionQuestionId: string;
  questionId: string;
  type: string;
  statement: string;
  position: number;
  points: number;
  options: OpcionApi[];
}

interface RespuestaApi {
  examVersionQuestionId: string;
  optionIds: string[];
  text: string | null;
  answeredAt: string | null;
}

interface ExamenDetalleApi {
  id: string;
  title: string;
  description: string | null;
  durationMinutes: number | null;
  closesAt: string | null;
  attemptId: string;
  attemptStatus: string;
  deadlineAt: string;
  attemptsUsed: number;
  maxAttempts: number | null;
  questions: PreguntaApi[];
  answers: RespuestaApi[];
}

interface IntentoApi {
  attemptId: string;
  deadlineAt: string;
}

function aTipoPregunta(tipo: string): TipoPregunta {
  switch (tipo) {
    case 'SINGLE_CHOICE':
      return 'CHOICE';
    case 'MULTIPLE_CHOICE':
      return 'MULTIPLE_CHOICE';
    case 'TRUE_FALSE':
      return 'TRUE_FALSE';
    case 'SHORT_TEXT':
      return 'SHORT_TEXT';
    case 'ESSAY':
      return 'ESSAY';
    default:
      return 'NO_SOPORTADO';
  }
}

function esRespuestaDeTexto(tipo: TipoPregunta): boolean {
  return tipo === 'SHORT_TEXT' || tipo === 'ESSAY';
}

@Injectable({ providedIn: 'root' })
export class ExamenService {
  private http = inject(HttpClient);

  listarDisponibles(): Observable<ExamenDisponible[]> {
    return this.http
      .get<ExamenDisponibleApi[]>('/exams/available')
      .pipe(map((lista) => lista.map((examenApi) => this.aDisponible(examenApi))));
  }

  obtenerExamen(id: string): Observable<Examen | null> {
    return this.obtenerExamenActual(id).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 409) {
          return of(null);
        }

        return throwError(() => error);
      }),
    );
  }

  obtenerExamenActual(id: string): Observable<Examen> {
    return this.http
      .get<ExamenDetalleApi>(`/exams/${id}/student`)
      .pipe(map((detalleApi) => this.aExamen(detalleApi)));
  }

  iniciarIntento(id: string): Observable<IntentoExamen> {
    return this.http
      .post<IntentoApi>(`/exams/${id}/attempts`, {}, { observe: 'response' })
      .pipe(
        map((respuesta) => ({
          intentoId: respuesta.body?.attemptId ?? '',
          fechaLimite: respuesta.body?.deadlineAt ?? '',
          creado: respuesta.status === 201,
        })),
      );
  }

  guardarRespuesta(
    intentoId: string,
    pregunta: Pregunta,
    valor: Respuesta,
  ): Observable<void> {
    return this.http
      .put<unknown>(`/attempts/${intentoId}/answers/${pregunta.id}`, this.aCuerpoRespuesta(pregunta, valor))
      .pipe(map(() => undefined));
  }

  entregarExamen(intentoId: string): Observable<void> {
    return this.http.post<unknown>(`/attempts/${intentoId}/submit`, {}).pipe(map(() => undefined));
  }

  private aCuerpoRespuesta(pregunta: Pregunta, valor: Respuesta): Record<string, unknown> {
    if (esRespuestaDeTexto(pregunta.tipo)) {
      return { text: typeof valor === 'string' ? valor : '' };
    }

    if (pregunta.tipo === 'MULTIPLE_CHOICE') {
      return { optionIds: Array.isArray(valor) ? valor : [] };
    }

    return { optionId: typeof valor === 'string' ? valor : '' };
  }

  private aDisponible(examenApi: ExamenDisponibleApi): ExamenDisponible {
    return {
      id: examenApi.id,
      titulo: examenApi.title,
      descripcion: examenApi.description,
      grupo: examenApi.groupName,
      estado: examenApi.status,
      abreEn: examenApi.opensAt,
      cierraEn: examenApi.closesAt,
      duracionMinutos: examenApi.durationMinutes,
      intentosUsados: examenApi.attemptsUsed,
      intentosMaximos: examenApi.maxAttempts,
      intentoEnCurso: examenApi.hasInProgress,
      cantidadPreguntas: examenApi.questionCount ?? 0,
      puntajeTotal: examenApi.totalPoints ?? 0,
      puedeIniciar: examenApi.canStart,
    };
  }

  private aExamen(detalleApi: ExamenDetalleApi): Examen {
    const preguntas = detalleApi.questions.map((preguntaApi) => this.aPregunta(preguntaApi));

    return {
      id: detalleApi.id,
      titulo: detalleApi.title,
      descripcion: detalleApi.description,
      grupo: null,
      duracionMinutos: detalleApi.durationMinutes,
      cierraEn: detalleApi.closesAt,
      intentoId: detalleApi.attemptId,
      fechaLimite: detalleApi.deadlineAt,
      intentosUsados: detalleApi.attemptsUsed,
      intentosMaximos: detalleApi.maxAttempts,
      preguntas,
      respuestas: this.aRespuestas(preguntas, detalleApi.answers),
    };
  }

  private aPregunta(preguntaApi: PreguntaApi): Pregunta {
    const tipo = aTipoPregunta(preguntaApi.type);

    return {
      id: preguntaApi.examVersionQuestionId,
      tipo,
      enunciado: preguntaApi.statement,
      puntaje: preguntaApi.points,
      posicion: preguntaApi.position,
      opciones: this.aOpciones(tipo, preguntaApi.options),
    };
  }

  private aOpciones(tipo: TipoPregunta, opcionesApi: OpcionApi[]): OpcionPregunta[] {
    if (esRespuestaDeTexto(tipo) || tipo === 'NO_SOPORTADO') {
      return [];
    }

    return (opcionesApi ?? []).map((opcionApi) => ({
      id: opcionApi.id,
      texto: opcionApi.content,
      posicion: opcionApi.position,
    }));
  }

  private aRespuestas(
    preguntas: Pregunta[],
    respuestasApi: RespuestaApi[],
  ): Record<string, Respuesta> {
    const preguntasPorId = new Map(preguntas.map((pregunta) => [pregunta.id, pregunta]));
    const respuestas: Record<string, Respuesta> = {};

    for (const respuestaApi of respuestasApi) {
      const pregunta = preguntasPorId.get(respuestaApi.examVersionQuestionId);

      if (!pregunta) {
        continue;
      }

      if (esRespuestaDeTexto(pregunta.tipo)) {
        if (respuestaApi.text !== null) {
          respuestas[pregunta.id] = respuestaApi.text;
        }
        continue;
      }

      const opciones = respuestaApi.optionIds ?? [];

      if (opciones.length === 0) {
        continue;
      }

      respuestas[pregunta.id] =
        pregunta.tipo === 'MULTIPLE_CHOICE' ? opciones : opciones[0];
    }

    return respuestas;
  }
}
