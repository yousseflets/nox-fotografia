import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { filter, firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Preencha e-mail e senha válidos (mínimo 6 caracteres).');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);

      let user;
      try {
        user = await firstValueFrom(
          this.auth.user$.pipe(
            filter((u): u is NonNullable<typeof u> => !!u),
            timeout({ first: 8000 })
          )
        );
      } catch {
        this.error.set(
          'Login ok, mas falta o perfil no Firestore (coleção users/{uid} com role = admin).'
        );
        return;
      }

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl) {
        await this.router.navigateByUrl(returnUrl);
      } else {
        await this.router.navigateByUrl(user.role === 'admin' ? '/admin' : '/cliente');
      }
    } catch (err) {
      if (err instanceof FirebaseError) {
        this.error.set('E-mail ou senha inválidos.');
      } else {
        this.error.set('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
