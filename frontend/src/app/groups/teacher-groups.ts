import { Component, OnInit, inject, signal } from '@angular/core';
import { GruposService } from './groups.service';
import { GrupoDelProfesor } from './group.model';

@Component({
  imports: [],
  selector: 'app-grupos-profesor',
  styleUrl: './teacher-groups.scss',
  templateUrl: './teacher-groups.html',
})
export class GruposProfesor implements OnInit {
  private grupoService = inject(GruposService);

  //Estado de la pantalla
  grupos = signal<GrupoDelProfesor[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarGrupos();
  }

  cargarGrupos(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    this.grupoService.obtenerGruposProfesor().subscribe({
      next: (grupos) => {
        this.grupos.set(grupos);
        this.cargando.set(false);
      },
      error: () => {
        this.mensajeError.set('No se pudieron cargar tus grupos. Intentá de nuevo.');
        this.cargando.set(false);
      },
    });
  }
}
