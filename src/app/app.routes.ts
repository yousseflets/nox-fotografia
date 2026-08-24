import { Routes } from '@angular/router';
import { adminGuard, clientGuard, guestGuard } from './core/guards/auth.guards';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'portfolio/:slug',
    loadComponent: () =>
      import('./pages/portfolio/portfolio-category.component').then(
        (m) => m.PortfolioCategoryComponent
      ),
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
    path: 'fotos',
    loadComponent: () =>
      import('./pages/sales/events-list/sales-events-list.component').then(
        (m) => m.SalesEventsListComponent
      ),
  },
  {
    path: 'fotos/pedido/:orderId',
    loadComponent: () =>
      import('./pages/sales/order-status/sales-order-status.component').then(
        (m) => m.SalesOrderStatusComponent
      ),
  },
  {
    path: 'fotos/:slug',
    loadComponent: () =>
      import('./pages/sales/event-gallery/sales-event-gallery.component').then(
        (m) => m.SalesEventGalleryComponent
      ),
  },
  {
    path: 'carrinho',
    loadComponent: () =>
      import('./pages/sales/cart/sales-cart.component').then((m) => m.SalesCartComponent),
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
      {
        path: 'vendas',
        loadComponent: () =>
          import('./pages/admin/sales/admin-sales.component').then((m) => m.AdminSalesComponent),
      },
      {
        path: 'vendas/:id',
        loadComponent: () =>
          import('./pages/admin/sale-detail/admin-sale-detail.component').then(
            (m) => m.AdminSaleDetailComponent
          ),
      },
      {
        path: 'depoimentos',
        loadComponent: () =>
          import('./pages/admin/testimonials/admin-testimonials.component').then(
            (m) => m.AdminTestimonialsComponent
          ),
      },
      {
        path: 'galeria',
        loadComponent: () =>
          import('./pages/admin/gallery/admin-gallery.component').then(
            (m) => m.AdminGalleryComponent
          ),
      },
      {
        path: 'portfolio-categorias',
        loadComponent: () =>
          import('./pages/admin/portfolio-categories/admin-portfolio-categories.component').then(
            (m) => m.AdminPortfolioCategoriesComponent
          ),
      },
      {
        path: 'portfolio-fotos',
        loadComponent: () =>
          import('./pages/admin/portfolio-photos/admin-portfolio-photos.component').then(
            (m) => m.AdminPortfolioPhotosComponent
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
