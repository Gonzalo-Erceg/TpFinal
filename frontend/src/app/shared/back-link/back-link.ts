import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-back-link',
  imports: [RouterLink],
  templateUrl: './back-link.html',
  styleUrl: './back-link.scss',
})
export class BackLink {
  @Input({ required: true }) destino!: string | (string | number)[];
  @Input() etiqueta = 'Volver';
}
