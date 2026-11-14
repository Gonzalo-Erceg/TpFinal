import { Component, OnInit, inject, signal } from '@angular/core';
import { GruposService } from './groups.service';
import { GrupoDelProfesor, Alumno, EstadoAlumno } from './group.model';
import { DialogoCrearGrupo } from './create-group-dialog';
import { DatePipe } from '@angular/common';


@Component({
  imports: [DialogoCrearGrupo, DatePipe],
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
  codigoCopiado = signal<string | null>(null);
  grupoSeleccionado = signal<GrupoDelProfesor | null>(null);
  miembros = signal<Alumno[]>([]);
  cargandoMiembros = signal(false);
  errorMiembros = signal<string | null>(null);
  errorAccion = signal<string |null>(null);

  // Texto que se muestra para cada estado
  etiquetasEstado: Record<EstadoAlumno, string> = {
    PENDING: 'Pendiente',
    ACTIVE: 'Activo',
    REJECTED: 'Rechazado',
    REMOVED: 'Removido',
  };

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

  copiarCodigo(grupo: GrupoDelProfesor): void {
    navigator.clipboard.writeText(grupo.codigoDeAcceso).then(() => {
      this.codigoCopiado.set(grupo.id);

      setTimeout(() => {
        this.codigoCopiado.set(null);
      }, 2000);
    });
  }

  //Se ejecuta al hacer clic en "Ver solicitudes"
  seleccionarGrupo(grupo: GrupoDelProfesor): void {
    this.grupoSeleccionado.set(grupo);
    this.errorAccion.set(null);
    this.cargarMiembros(grupo.id);
  }

  cargarMiembros(grupoId: string): void {
    this.cargandoMiembros.set(true);
    this.errorMiembros.set(null);

    this.grupoService.obtenerMiembros(grupoId).subscribe({
      next: (miembros) => {
        this.miembros.set(miembros);
        this.cargandoMiembros.set(false);
      },
      error: () => {
        this.errorMiembros.set('No se pudieron cargar las solicitudes. Intentá de nuevo.');
        this.cargandoMiembros.set(false);
      },
    });
  }

  cambiarEstado(miembro: Alumno, nuevoEstado: EstadoAlumno): void {
    const grupo = this.grupoSeleccionado();
    if (!grupo) {
      return;
    }

    this.errorAccion.set(null);

    this.grupoService.cambiarEstadoMiembro(grupo.id, miembro.id, nuevoEstado).subscribe({
      next: (miembroActualizado) => {
        this.miembros.update((lista) =>
          lista.map((m) => (m.id === miembroActualizado.id ? miembroActualizado : m))
        );
      },
      error: () => {
        this.errorAccion.set('No se pudo actualizar la solicitud. Intentá de nuevo.');
      },
    });
  }
}
