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
  readonly message = signal('');
  readonly showPassword = signal(false);
  readonly mode = signal<'login' | 'forgot'>('login');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    if (this.route.snapshot.queryParamMap.get('idle') === '1') {
      this.message.set(
        'Sess\u00e3o encerrada ap\u00f3s 1 hora sem uso. Entre novamente para continuar.'
      );
    }
  }

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  openForgot() {
    this.mode.set('forgot');
    this.error.set('');
    this.message.set('');
    this.form.controls.password.reset('');
  }

  backToLogin() {
    this.mode.set('login');
    this.error.set('');
    this.message.set('');
  }

  async submit() {
    if (this.mode() === 'forgot') {
      await this.sendReset();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Preencha e-mail e senha v\u00e1lidos (m\u00ednimo 6 caracteres).');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

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
          'Login ok, mas falta o perfil no Firestore (cole\u00e7\u00e3o users/{uid} com role = admin).'
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
        this.error.set('E-mail ou senha inv\u00e1lidos.');
      } else {
        this.error.set('N\u00e3o foi poss\u00edvel entrar. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  private async sendReset() {
    const emailCtrl = this.form.controls.email;
    if (emailCtrl.invalid) {
      emailCtrl.markAsTouched();
      this.error.set('Informe um e-mail v\u00e1lido para recuperar a senha.');
      this.message.set('');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      await this.auth.resetPassword(emailCtrl.value);
      this.message.set(
        'Enviamos um link de redefini\u00e7\u00e3o para o seu e-mail. Confira tamb\u00e9m a caixa de spam.'
      );
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/invalid-email') {
          this.error.set('E-mail inv\u00e1lido.');
        } else if (err.code === 'auth/too-many-requests') {
          this.error.set('Muitas tentativas. Aguarde um pouco e tente de novo.');
        } else if (err.code === 'auth/user-not-found') {
          this.message.set(
            'Se este e-mail estiver cadastrado, voc\u00ea receber\u00e1 um link para redefinir a senha.'
          );
        } else {
          this.error.set('N\u00e3o foi poss\u00edvel enviar o e-mail. Tente novamente.');
        }
      } else {
        this.error.set('N\u00e3o foi poss\u00edvel enviar o e-mail. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
