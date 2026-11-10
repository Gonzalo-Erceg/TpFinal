import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { EstadoMembresia, Grupo } from './group.model';

// Mientras el backend no tenga los endpoints, se usan datos de prueba.
// Cuando existan GET /groups y POST /groups/join, cambiar esto a false.
const USAR_DATOS_DE_PRUEBA = true;

// Forma en que el backend devuelve un grupo (campos en inglés)
interface GrupoApi {
  id: number;
  name: string;
  subject: string;
  teacher: string;
  membershipStatus: EstadoMembresia;
}

@Injectable({ providedIn: 'root' })
export class GruposService {
  private http = inject(HttpClient);

  // DATOS DE PRUEBA: grupos del alumno
  private grupos: Grupo[] = [
    { id: 1, nombre: 'Matemática - Comisión A', materia: 'Matemática', profesor: 'Prof. Pérez', estadoMembresia: 'ACTIVE' },
    { id: 2, nombre: 'Programación I - Comisión B', materia: 'Programación I', profesor: 'Prof. López', estadoMembresia: 'PENDING' },
    { id: 3, nombre: 'Base de Datos - Comisión C', materia: 'Base de Datos', profesor: 'Prof. Díaz', estadoMembresia: 'REJECTED' },
  ];

  // DATOS DE PRUEBA: códigos que "existen" en el sistema
  private codigosValidos: Record<string, Grupo> = {
    ABC123: { id: 4, nombre: 'Inglés Técnico - Comisión A', materia: 'Inglés Técnico', profesor: 'Prof. Gómez', estadoMembresia: 'PENDING' },
    MAT001: { id: 1, nombre: 'Matemática - Comisión A', materia: 'Matemática', profesor: 'Prof. Pérez', estadoMembresia: 'PENDING' },
  };

  // Equivale a GET /groups
  obtenerGrupos(): Observable<Grupo[]> {
    if (USAR_DATOS_DE_PRUEBA) {
      return of([...this.grupos]).pipe(delay(500));
    }

    return this.http
      .get<GrupoApi[]>('/groups')
      .pipe(map((lista) => lista.map((grupoApi) => this.aGrupo(grupoApi))));
  }

  // Equivale a POST /groups/join
  unirseAGrupo(codigo: string): Observable<Grupo> {
    if (USAR_DATOS_DE_PRUEBA) {
      return this.unirseConDatosDePrueba(codigo);
    }

    return this.http
      .post<GrupoApi>('/groups/join', { code: codigo })
      .pipe(map((grupoApi) => this.aGrupo(grupoApi)));
  }

  // Traduce el grupo del backend (inglés) al modelo del front (español)
  private aGrupo(grupoApi: GrupoApi): Grupo {
    return {
      id: grupoApi.id,
      nombre: grupoApi.name,
      materia: grupoApi.subject,
      profesor: grupoApi.teacher,
      estadoMembresia: grupoApi.membershipStatus,
    };
  }

  private unirseConDatosDePrueba(codigo: string): Observable<Grupo> {
    const grupoEncontrado = this.codigosValidos[codigo];

    // Código inexistente: el backend real devolvería 404
    if (!grupoEncontrado) {
      return throwError(() => new HttpErrorResponse({ status: 404 })).pipe(delay(500));
    }

    // Grupo que el alumno ya tiene: el backend real devolvería 409
    if (this.grupos.some((grupo) => grupo.id === grupoEncontrado.id)) {
      return throwError(() => new HttpErrorResponse({ status: 409 })).pipe(delay(500));
    }

    this.grupos.push(grupoEncontrado);
    return of(grupoEncontrado).pipe(delay(500));
  }
}