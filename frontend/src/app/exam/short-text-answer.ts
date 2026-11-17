import { Component, computed, input, output } from '@angular/core';
import { Pregunta, Respuesta } from './exam.model';

export const LIMITE_CARACTERES = 300;
export const LIMITE_DESARROLLO = 5000;

@Component({
  selector: 'app-respuesta-short-text',
  templateUrl: './short-text-answer.html',
  styleUrl: './answer-styles.scss',
})
export class RespuestaShortText {
  pregunta = input.required<Pregunta>();
  respuesta = input<Respuesta | undefined>();
  limite = input(LIMITE_CARACTERES);
  respuestaCambiada = output<string>();

  texto = computed(() => {
    const valor = this.respuesta();
    return typeof valor === 'string' ? valor : '';
  });

  alEscribir(evento: Event): void {
    const campo = evento.target as HTMLTextAreaElement;
    this.respuestaCambiada.emit(campo.value);
  }
}
