import { Routes } from '@angular/router';
import { adminGuard, clientGuard, guestGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'cadastro',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin/dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'clientes',
        loadComponent: () =>
          import('./pages/admin/clients/admin-clients.component').then(
            (m) => m.AdminClientsComponent
          ),
      },
      {
        path: 'albuns',
        loadComponent: () =>
          import('./pages/admin/albums/admin-albums.component').then((m) => m.AdminAlbumsComponent),
      },
      {
        path: 'albuns/:id',
        loadComponent: () =>
          import('./pages/admin/album-detail/admin-album-detail.component').then(
            (m) => m.AdminAlbumDetailComponent
          ),
      },
    ],
  },
  {
    path: 'cliente',
    canActivate: [clientGuard],
    loadComponent: () =>
      import('./pages/client/layout/client-layout.component').then((m) => m.ClientLayoutComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/client/albums/client-albums.component').then(
            (m) => m.ClientAlbumsComponent
          ),
      },
      {
        path: 'album/:id',
        loadComponent: () =>
          import('./pages/client/album-detail/client-album-detail.component').then(
            (m) => m.ClientAlbumDetailComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
