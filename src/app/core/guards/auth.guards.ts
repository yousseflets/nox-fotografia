import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.user$.pipe(
    take(1),
    map((user) => {
      if (user?.role === 'admin') return true;
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: '/admin' } });
    })
  );
};

export const clientGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.user$.pipe(
    take(1),
    map((user) => {
      if (user?.role === 'client') return true;
      if (user?.role === 'admin') return router.createUrlTree(['/admin']);
      return router.createUrlTree(['/login'], { queryParams: { returnUrl: '/cliente' } });
    })
  );
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.user$.pipe(
    take(1),
    map((user) => {
      if (!user) return true;
      if (user.role === 'admin') return router.createUrlTree(['/admin']);
      return router.createUrlTree(['/cliente']);
    })
  );
};
