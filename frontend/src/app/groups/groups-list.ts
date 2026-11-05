import { Component, inject, OnInit, signal } from '@angular/core';
import { GruposService } from './groups.service';
import { EstadoMembresia, Grupo } from './group.model';
import { DialogoUnirse } from './join-dialog';

@Component({
  selector: 'app-lista-grupos',
  imports: [DialogoUnirse],
  templateUrl: './groups-list.html',
  styleUrl: './groups-list.scss',
})
export class ListaGrupos implements OnInit {
  private gruposService = inject(GruposService);

  // Estado de la pantalla
  grupos = signal<Grupo[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  mostrarDialogo = signal(false);
  mensajeExito = signal<string | null>(null);

  // Texto en español que se muestra para cada estado de membresía
  etiquetasEstado: Record<EstadoMembresia, string> = {
    PENDING: 'Pendiente',
    ACTIVE: 'Activo',
    REJECTED: 'Rechazado',
  };

  ngOnInit(): void {
    this.cargarGrupos();
  }

  cargarGrupos(): void {
    this.cargando.set(true);
    this.mensajeError.set(null);

    this.gruposService.obtenerGrupos().subscribe({
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
    this.mensajeExito.set(null);
    this.mostrarDialogo.set(true);
  }

  cerrarDialogo(): void {
    this.mostrarDialogo.set(false);
  }

  // Se ejecuta cuando el diálogo avisa que la solicitud se envió bien
  alEnviarSolicitud(grupo: Grupo): void {
    this.grupos.update((lista) => [...lista, grupo]);
    this.mostrarDialogo.set(false);
    this.mensajeExito.set(`Solicitud enviada a "${grupo.nombre}". Queda pendiente hasta que el profesor la apruebe.`);
  }
}