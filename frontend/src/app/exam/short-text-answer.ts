import { Component, computed, input, output } from '@angular/core';
import { Pregunta, Respuesta } from './exam.model';

// Límite supuesto para respuestas cortas, confirmar con el equipo
const LIMITE_CARACTERES = 300;

@Component({
  selector: 'app-respuesta-short-text',
  templateUrl: './short-text-answer.html',
  styleUrl: './answer-styles.scss',
})
export class RespuestaShortText {
  pregunta = input.required<Pregunta>();
  respuesta = input<Respuesta | undefined>();
  respuestaCambiada = output<string>();

  limite = LIMITE_CARACTERES;

  texto = computed(() => {
    const valor = this.respuesta();
    return typeof valor === 'string' ? valor : '';
  });

  alEscribir(evento: Event): void {
    const campo = evento.target as HTMLTextAreaElement;
    this.respuestaCambiada.emit(campo.value);
  }
}