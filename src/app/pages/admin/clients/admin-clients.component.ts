import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/album.service';
import { AppUser } from '../../../core/models/user.model';

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe],
  templateUrl: './admin-clients.component.html',
  styleUrl: './admin-clients.component.scss',
})
export class AdminClientsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);

  readonly clients$ = this.users.getClients();
  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly editingUid = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(6)]],
  });

  startEdit(client: AppUser) {
    this.editingUid.set(client.uid);
    this.message.set('');
    this.error.set('');
    this.form.setValue({
      name: client.name,
      email: client.email,
      password: '',
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
  }

  cancelEdit() {
    this.editingUid.set(null);
    this.form.reset();
    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(6),
    ]);
    this.form.controls.password.updateValueAndValidity();
    this.message.set('');
    this.error.set('');
  }

  async submit() {
    if (this.editingUid()) {
      await this.saveEdit();
      return;
    }

    this.form.controls.password.setValidators([
      Validators.required,
      Validators.minLength(6),
    ]);
    this.form.controls.password.updateValueAndValidity();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const { name, email, password } = this.form.getRawValue();
      await this.auth.createClientAccount(name, email, password);
      this.message.set('Cliente cadastrado com sucesso.');
      this.form.reset();
    } catch {
      this.error.set('Falha ao cadastrar. O e-mail pode já estar em uso.');
    } finally {
      this.loading.set(false);
    }
  }

  private async saveEdit() {
    const uid = this.editingUid();
    if (!uid) return;

    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();

    if (this.form.controls.name.invalid || this.form.controls.email.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const { name, email } = this.form.getRawValue();
      await this.users.updateClient(uid, { name, email });
      this.cancelEdit();
      this.message.set('Cliente atualizado.');
    } catch {
      this.error.set('Não foi possível atualizar o cliente.');
    } finally {
      this.loading.set(false);
    }
  }

  async remove(client: AppUser) {
    const ok = confirm(
      `Excluir o cliente "${client.name}"?\nÁlbuns e fotos associados também serão removidos.`
    );
    if (!ok) return;

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      await this.users.deleteClient(client.uid);
      if (this.editingUid() === client.uid) this.cancelEdit();
      this.message.set('Cliente excluído.');
    } catch {
      this.error.set('Não foi possível excluir o cliente.');
    } finally {
      this.loading.set(false);
    }
  }
}
