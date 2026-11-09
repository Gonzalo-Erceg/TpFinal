import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Examen } from './exam.model';

@Injectable({ providedIn: 'root' })
export class ExamenService {
  private examenDePrueba: Examen = {
    id: 1,
    titulo: 'Primer parcial',
    materia: 'Programación I',
    preguntas: [
      {
        id: 1,
        tipo: 'CHOICE',
        enunciado: '¿Qué responsabilidad cumple una API REST?',
        puntaje: 1,
        opciones: [
          { id: 'a', texto: 'Dibujar automáticamente todas las pantallas de la aplicación.' },
          { id: 'b', texto: 'Exponer recursos mediante HTTP y definir una interfaz de comunicación.' },
          { id: 'c', texto: 'Administrar directamente la memoria física del dispositivo.' },
          { id: 'd', texto: 'Reemplazar al sistema operativo que ejecuta la aplicación.' },
        ],
      },
      {
        id: 2,
        tipo: 'CHOICE',
        enunciado: '¿Qué devuelve typeof null en JavaScript?',
        puntaje: 1,
        opciones: [
          { id: 'a', texto: 'null' },
          { id: 'b', texto: 'object' },
          { id: 'c', texto: 'undefined' },
          { id: 'd', texto: 'number' },
        ],
      },
      {
        id: 3,
        tipo: 'TRUE_FALSE',
        enunciado: 'En JavaScript, una variable declarada con const no puede reasignarse.',
        puntaje: 1,
      },
      {
        id: 4,
        tipo: 'SHORT_TEXT',
        enunciado: 'Explicá qué es el hoisting y da un ejemplo.',
        puntaje: 2,
      },
      {
        id: 5,
        tipo: 'CHOICE',
        enunciado: '¿Qué método agrega un elemento al final de un array?',
        puntaje: 1,
        opciones: [
          { id: 'a', texto: 'push()' },
          { id: 'b', texto: 'pop()' },
          { id: 'c', texto: 'shift()' },
          { id: 'd', texto: 'slice()' },
        ],
      },
      {
        id: 6,
        tipo: 'TRUE_FALSE',
        enunciado: 'Java y JavaScript son el mismo lenguaje de programación.',
        puntaje: 1,
      },
      {
        id: 7,
        tipo: 'SHORT_TEXT',
        enunciado: '¿Qué significa la sigla HTTP?',
        puntaje: 1,
      },
    ],
  };

  // Datos simulados: cuando exista el backend se reemplaza por la llamada a la API
  obtenerExamen(): Observable<Examen> {
    return of(this.examenDePrueba).pipe(delay(500));
  }
}