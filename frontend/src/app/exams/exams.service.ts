import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TipoPregunta } from '../questions/question.model';
import {
  AlcanceIntentos,
  DatosExamen,
  EstadoExamen,
  EstadoVersionExamen,
  ExamenCerrado,
  ExamenCreado,
  ExamenDetalle,
  ExamenPublicado,
  ExamenResumen,
  IntentoExamenResumen,
  LiberacionResultados,
  ModoLiberacion,
} from './exam.model';

interface ExamenResumenApi {
  id: string;
  title: string;
  description: string | null;
  status: EstadoExamen;
  currentVersionId: string | null;
  currentVersionStatus: EstadoVersionExamen | null;
  publishAt: string | null;
  opensAt: string | null;
  closesAt: string | null;
  durationMinutes: number | null;
  maxAttempts: number | null;
  attemptsScope: AlcanceIntentos;
  groupIds: string[];
  questionCount: number;
  attemptCount: number;
  resultsReleaseMode: ModoLiberacion;
  resultsReleasedAt: string | null;
  showCorrectAnswers: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PreguntaExamenApi {
  examVersionQuestionId: string;
  questionId: string;
  revisionId: string;
  title: string | null;
  type: TipoPregunta;
  statement: string;
  position: number;
  points: number;
  options: {
    id: string;
    content: string;
    position: number;
    creditFraction: number;
  }[];
}

interface ExamenDetalleApi extends ExamenResumenApi {
  currentVersionNumber: number | null;
  groups: { id: string; name: string; accessCode: string }[];
  questions: PreguntaExamenApi[];
}

interface LiberacionApi {
  id: string;
  status: EstadoExamen;
  resultsReleaseMode: ModoLiberacion;
  resultsReleasedAt: string | null;
}

interface IntentoApi {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  attemptNumber: number;
  status: string;
  startedAt: string | null;
  submittedAt: string | null;
  totalScore: number | null;
  maxScore: number | null;
  gradedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class ExamenesService {
  private http = inject(HttpClient);

  listar(): Observable<ExamenResumen[]> {
    return this.http
      .get<ExamenResumenApi[]>('/exams')
      .pipe(map((lista) => lista.map((examenApi) => this.aResumen(examenApi))));
  }

  obtener(id: string): Observable<ExamenDetalle> {
    return this.http
      .get<ExamenDetalleApi>(`/exams/${id}`)
      .pipe(map((examenApi) => this.aDetalle(examenApi)));
  }

  crear(datos: DatosExamen): Observable<ExamenCreado> {
    return this.http.post<ExamenCreado>('/exams', this.aBodyMetadatos(datos));
  }

  actualizar(id: string, datos: DatosExamen): Observable<ExamenDetalle> {
    return this.http
      .put<ExamenDetalleApi>(`/exams/${id}`, this.aBodyCompleto(datos))
      .pipe(map((examenApi) => this.aDetalle(examenApi)));
  }

  publicar(id: string, publicaEn: string | null = null): Observable<ExamenPublicado> {
    return this.http.post<ExamenPublicado>(`/exams/${id}/publish`, {
      publishAt: publicaEn,
    });
  }

  cerrar(id: string): Observable<ExamenCerrado> {
    return this.http.post<ExamenCerrado>(`/exams/${id}/close`, {});
  }

  liberarResultados(id: string): Observable<LiberacionResultados> {
    return this.http
      .post<LiberacionApi>(`/exams/${id}/release-results`, {})
      .pipe(
        map((liberacionApi) => ({
          id: liberacionApi.id,
          estado: liberacionApi.status,
          modoLiberacion: liberacionApi.resultsReleaseMode,
          liberadoEn: liberacionApi.resultsReleasedAt,
        })),
      );
  }

  obtenerIntentos(id: string): Observable<IntentoExamenResumen[]> {
    return this.http
      .get<IntentoApi[]>(`/exams/${id}/attempts`)
      .pipe(
        map((intentos) =>
          intentos.map((intentoApi) => ({
            intentoId: intentoApi.attemptId,
            estudianteId: intentoApi.studentId,
            estudianteNombre: intentoApi.studentName,
            estudianteEmail: intentoApi.studentEmail,
            numeroIntento: intentoApi.attemptNumber,
            estado: intentoApi.status as IntentoExamenResumen['estado'],
            iniciadoEn: intentoApi.startedAt,
            entregadoEn: intentoApi.submittedAt,
            puntajeTotal: intentoApi.totalScore,
            puntajeMaximo: intentoApi.maxScore,
            corregidoEn: intentoApi.gradedAt,
          })),
        ),
      );
  }

  private aBodyMetadatos(datos: DatosExamen): Record<string, unknown> {
    return {
      title: datos.titulo,
      description: datos.descripcion,
      opensAt: datos.abreEn,
      closesAt: datos.cierraEn,
      durationMinutes: datos.duracionMinutos,
      maxAttempts: datos.intentosMaximos,
      resultsReleaseMode: datos.modoLiberacion,
      showCorrectAnswers: datos.mostrarCorrectas,
    };
  }

  private aBodyCompleto(datos: DatosExamen): Record<string, unknown> {
    const body = this.aBodyMetadatos(datos);

    if (datos.gruposIds !== undefined) {
      body['groupIds'] = datos.gruposIds;
    }

    if (datos.preguntas !== undefined) {
      body['questions'] = datos.preguntas.map((pregunta, indice) => ({
        questionId: pregunta.preguntaId,
        points: pregunta.puntos,
        position: indice + 1,
      }));
    }

    return body;
  }

  private aResumen(examenApi: ExamenResumenApi): ExamenResumen {
    return {
      id: examenApi.id,
      titulo: examenApi.title,
      descripcion: examenApi.description,
      estado: examenApi.status,
      versionActualId: examenApi.currentVersionId,
      estadoVersionActual: examenApi.currentVersionStatus,
      publicaEn: examenApi.publishAt,
      abreEn: examenApi.opensAt,
      cierraEn: examenApi.closesAt,
      duracionMinutos: examenApi.durationMinutes,
      intentosMaximos: examenApi.maxAttempts,
      alcanceIntentos: examenApi.attemptsScope,
      gruposIds: examenApi.groupIds ?? [],
      cantidadPreguntas: examenApi.questionCount ?? 0,
      cantidadIntentos: examenApi.attemptCount ?? 0,
      modoLiberacion: examenApi.resultsReleaseMode ?? 'MANUAL',
      liberadoEn: examenApi.resultsReleasedAt ?? null,
      mostrarCorrectas: examenApi.showCorrectAnswers ?? false,
      creadoEn: examenApi.createdAt,
      actualizadoEn: examenApi.updatedAt,
    };
  }

  private aDetalle(examenApi: ExamenDetalleApi): ExamenDetalle {
    return {
      ...this.aResumen(examenApi),
      numeroVersionActual: examenApi.currentVersionNumber,
      grupos: examenApi.groups.map((grupo) => ({
        id: grupo.id,
        nombre: grupo.name,
        codigoDeAcceso: grupo.accessCode,
      })),
      preguntas: examenApi.questions.map((pregunta) => ({
        idExamenVersionPregunta: pregunta.examVersionQuestionId,
        preguntaId: pregunta.questionId,
        revisionId: pregunta.revisionId,
        titulo: pregunta.title,
        tipo: pregunta.type,
        enunciado: pregunta.statement,
        posicion: pregunta.position,
        puntos: pregunta.points,
      })),
    };
  }
}
