import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of, switchMap, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.firebaseUser$.pipe(
    take(1),
    switchMap((fbUser) => {
      if (!fbUser) {
        return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: '/admin' } }));
      }
      return auth.user$.pipe(
        take(1),
        map((user) => {
          if (user?.role === 'admin') return true;
          return router.createUrlTree(['/login'], { queryParams: { returnUrl: '/admin' } });
        })
      );
    })
  );
};

export const clientGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.firebaseUser$.pipe(
    take(1),
    switchMap((fbUser) => {
      if (!fbUser) {
        return of(router.createUrlTree(['/login'], { queryParams: { returnUrl: '/cliente' } }));
      }
      return auth.user$.pipe(
        take(1),
        map((user) => {
          if (user?.role === 'client') return true;
          if (user?.role === 'admin') return router.createUrlTree(['/admin']);
          return router.createUrlTree(['/login'], { queryParams: { returnUrl: '/cliente' } });
        })
      );
    })
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Usa o Auth do Firebase (não o cache do perfil) para não “devolver” o usuário após o logout.
  return auth.firebaseUser$.pipe(
    take(1),
    switchMap((fbUser) => {
      if (!fbUser) return of(true);
      return auth.user$.pipe(
        take(1),
        map((user) => {
          if (user?.role === 'admin') return router.createUrlTree(['/admin']);
          if (user?.role === 'client') return router.createUrlTree(['/cliente']);
          return true;
        })
      );
    })
  );
};
