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
  respuestaCambiada = output<string>();

  estaElegida(opcionId: string): boolean {
    return this.respuesta() === opcionId;
  }

  letra(opcionId: string, indice: number): string {
    const opcion = (this.pregunta().opciones ?? []).find((item) => item.id === opcionId);
    const texto = opcion?.texto.trim().toLowerCase() ?? '';

    if (texto.startsWith('verdadero')) {
      return 'V';
    }

    if (texto.startsWith('falso')) {
      return 'F';
    }

    return String.fromCharCode(65 + indice);
  }
}
