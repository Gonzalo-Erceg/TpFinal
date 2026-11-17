import { Component, PLATFORM_ID, computed, inject, OnInit, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GruposService } from './groups.service';
import { EstadoMembresia, Grupo } from './group.model';
import { DialogoUnirse } from './join-dialog';

type Filtro = 'TODOS' | EstadoMembresia;

@Component({
  selector: 'app-lista-grupos',
  imports: [DialogoUnirse],
  templateUrl: './groups-list.html',
  styleUrl: './groups-list.scss',
  host: { '[class.nocturno]': 'modoNocturno()' },
})
export class ListaGrupos implements OnInit {
  private gruposService = inject(GruposService);
  private esNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  grupos = signal<Grupo[]>([]);
  cargando = signal(true);
  mensajeError = signal<string | null>(null);
  mostrarDialogo = signal(false);
  mensajeExito = signal<string | null>(null);
  filtro = signal<Filtro>('TODOS');
  modoNocturno = signal(false);

  private ordenEstados: Record<EstadoMembresia, number> = { ACTIVE: 0, PENDING: 1, REJECTED: 2 };

  gruposOrdenados = computed(() =>
    [...this.grupos()].sort((a, b) => this.ordenEstados[a.estadoMembresia] - this.ordenEstados[b.estadoMembresia]),
  );

  gruposFiltrados = computed(() => {
    const filtroActual = this.filtro();
    const lista = this.gruposOrdenados();
    return filtroActual === 'TODOS' ? lista : lista.filter((grupo) => grupo.estadoMembresia === filtroActual);
  });

  cantidades = computed<Record<Filtro, number>>(() => ({
    TODOS: this.grupos().length,
    ACTIVE: this.contar('ACTIVE'),
    PENDING: this.contar('PENDING'),
    REJECTED: this.contar('REJECTED'),
  }));

  opcionesFiltro: { valor: Filtro; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    { valor: 'ACTIVE', etiqueta: 'Activos' },
    { valor: 'PENDING', etiqueta: 'Pendientes' },
    { valor: 'REJECTED', etiqueta: 'Rechazados' },
  ];

  etiquetasEstado: Record<EstadoMembresia, string> = {
    ACTIVE: 'Activo',
    PENDING: 'Pendiente',
    REJECTED: 'Rechazado',
  };

  iconosEstado: Record<EstadoMembresia, string> = {
    ACTIVE: '✓',
    PENDING: '◷',
    REJECTED: '✕',
  };

  ayudaEstado: Record<EstadoMembresia, string> = {
    ACTIVE: 'Ya formás parte de este grupo.',
    PENDING: 'Esperando que el docente apruebe tu solicitud.',
    REJECTED: 'El docente rechazó tu solicitud. Consultale antes de volver a intentarlo.',
  };

  private contar(estado: EstadoMembresia): number {
    return this.grupos().filter((grupo) => grupo.estadoMembresia === estado).length;
  }

  ngOnInit(): void {
    this.recuperarTema();
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

  elegirFiltro(filtro: Filtro): void {
    this.filtro.set(filtro);
  }

  alternarTema(): void {
    const nocturno = !this.modoNocturno();
    this.modoNocturno.set(nocturno);

    if (this.esNavegador) {
      try {
        localStorage.setItem('aula-theme', nocturno ? 'dark' : 'light');
      } catch {
      }
    }
  }

  private recuperarTema(): void {
    if (!this.esNavegador) {
      return;
    }
    try {
      this.modoNocturno.set(localStorage.getItem('aula-theme') === 'dark');
    } catch {
    }
  }

  abrirDialogo(): void {
    this.mensajeExito.set(null);
    this.mostrarDialogo.set(true);
  }

  cerrarDialogo(): void {
    this.mostrarDialogo.set(false);
  }

  alEnviarSolicitud(grupo: Grupo): void {
    this.grupos.update((lista) => [...lista.filter((g) => g.id !== grupo.id), grupo]);
    this.mostrarDialogo.set(false);
    this.mensajeExito.set(`Solicitud enviada a "${grupo.materia ?? grupo.nombre}". Queda pendiente hasta que el docente la apruebe.`);
  }
}