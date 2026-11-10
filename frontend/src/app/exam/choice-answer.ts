import { Component, input, output } from '@angular/core';
import { Pregunta, Respuesta } from './exam.model';

@Component({
  selector: 'app-respuesta-choice',
  templateUrl: './choice-answer.html',
  styleUrl: './answer-styles.scss',
})
export class RespuestaChoice {
  pregunta = input.required<Pregunta>();
  respuesta = input<Respuesta | undefined>();
  respuestaCambiada = output<string>();

  letra(posicion: number): string {
    return String.fromCharCode(65 + posicion);
  }
}