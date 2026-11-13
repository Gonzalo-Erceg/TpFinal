import { Component, OnInit, inject, signal } from '@angular/core';
import { GruposService } from './groups.service';
import { GrupoDelProfesor } from './group.model';
import { DialogoCrearGrupo } from './create-group-dialog';

@Component({
  imports: [DialogoCrearGrupo],
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
  mostrarDialogo = signal(false);

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

  abrirDialogo(): void {
    this.mostrarDialogo.set(true);
  }

  cerrarDialogo(): void {
    this.mostrarDialogo.set(false);
  }

  // Se ejecuta cuando el diálogo avisa que se creó un grupo
  alCrearGrupo(grupo: GrupoDelProfesor): void {
    this.grupos.update((lista) => [...lista, grupo]);
    this.mostrarDialogo.set(false);
  }
}
