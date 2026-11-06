import { Routes } from '@angular/router';
import { ListaGrupos } from './groups/groups-list';

export const routes: Routes = [
  { path: '', redirectTo: 'grupos', pathMatch: 'full' },
  { path: 'grupos', component: ListaGrupos },
];