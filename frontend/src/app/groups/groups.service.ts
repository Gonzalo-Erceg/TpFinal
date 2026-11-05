import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Grupo } from './group.model';

@Injectable({ providedIn: 'root' })
export class GruposService {
  private grupos: Grupo[] = [
    { id: 1, nombre: 'Matemática - Comisión A', materia: 'Matemática', profesor: 'Prof. Pérez', estadoMembresia: 'ACTIVE' },
    { id: 2, nombre: 'Programación I - Comisión B', materia: 'Programación I', profesor: 'Prof. López', estadoMembresia: 'PENDING' },
    { id: 3, nombre: 'Base de Datos - Comisión C', materia: 'Base de Datos', profesor: 'Prof. Díaz', estadoMembresia: 'REJECTED' },
  ];

  private codigosValidos: Record<string, Grupo> = {
    ABC123: { id: 4, nombre: 'Inglés Técnico - Comisión A', materia: 'Inglés Técnico', profesor: 'Prof. Gómez', estadoMembresia: 'PENDING' },
    MAT001: { id: 1, nombre: 'Matemática - Comisión A', materia: 'Matemática', profesor: 'Prof. Pérez', estadoMembresia: 'PENDING' },
  };

  obtenerGrupos(): Observable<Grupo[]> {
    return of([...this.grupos]).pipe(delay(500));
  }

  unirseAGrupo(codigo: string): Observable<Grupo> {
    const grupoEncontrado = this.codigosValidos[codigo];

    // Código inexistente: el backend real devolvería un error 404
    if (!grupoEncontrado) {
      return throwError(() => new HttpErrorResponse({ status: 404 })).pipe(delay(500));
    }

    // Grupo que el alumno ya tiene: el backend real devolvería un error 409 (conflicto)
    if (this.grupos.some(grupo => grupo.id === grupoEncontrado.id)) {
      return throwError(() => new HttpErrorResponse({ status: 409 })).pipe(delay(500));
    }

    this.grupos.push(grupoEncontrado);
    return of(grupoEncontrado).pipe(delay(500));
  }
}