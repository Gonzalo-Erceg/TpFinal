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
  multiple = input(false);
  respuestaCambiada = output<Respuesta>();

  letra(posicion: number): string {
    return String.fromCharCode(65 + posicion);
  }

  estaElegida(opcionId: string): boolean {
    const valor = this.respuesta();

    if (this.multiple()) {
      return Array.isArray(valor) && valor.includes(opcionId);
    }

    return valor === opcionId;
  }

  cambiar(opcionId: string): void {
    const valor = this.respuesta();

    if (this.multiple()) {
      const elegidas = Array.isArray(valor) ? valor : [];
      const nuevas = elegidas.includes(opcionId)
        ? elegidas.filter((id) => id !== opcionId)
        : [...elegidas, opcionId];

      this.respuestaCambiada.emit(nuevas);
      return;
    }

    this.respuestaCambiada.emit(opcionId);
  }
}
