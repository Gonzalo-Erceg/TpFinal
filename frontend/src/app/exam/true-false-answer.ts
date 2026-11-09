import { Component, input, output } from '@angular/core';
import { Pregunta, Respuesta } from './exam.model';

@Component({
  selector: 'app-respuesta-true-false',
  templateUrl: './true-false-answer.html',
  styleUrl: './answer-styles.scss',
})
export class RespuestaTrueFalse {
  pregunta = input.required<Pregunta>();
  respuesta = input<Respuesta | undefined>();
  respuestaCambiada = output<boolean>();

  opciones = [
    { valor: true, texto: 'Verdadero', letra: 'V' },
    { valor: false, texto: 'Falso', letra: 'F' },
  ];
}