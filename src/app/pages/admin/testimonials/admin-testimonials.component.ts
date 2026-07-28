import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FirebaseError } from 'firebase/app';
import { TestimonialService } from '../../../core/services/testimonial.service';
import { Testimonial } from '../../../core/models/testimonial.model';

@Component({
  selector: 'app-admin-testimonials',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe],
  templateUrl: './admin-testimonials.component.html',
  styleUrl: './admin-testimonials.component.scss',
})
export class AdminTestimonialsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly testimonials = inject(TestimonialService);

  readonly list$ = this.testimonials.getAll();
  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly editingId = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    quote: ['', [Validators.required, Validators.minLength(10)]],
  });

  startEdit(item: Testimonial) {
    if (!item.id) return;
    this.editingId.set(item.id);
    this.message.set('');
    this.error.set('');
    this.form.setValue({
      name: item.name,
      quote: item.quote,
    });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.form.reset();
    this.message.set('');
    this.error.set('');
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    const { name, quote } = this.form.getRawValue();
    const id = this.editingId();

    try {
      if (id) {
        await this.testimonials.update(id, { name, quote });
        this.cancelEdit();
        this.message.set('Depoimento atualizado.');
      } else {
        await this.testimonials.create({
          name,
          quote,
          createdAt: new Date().toISOString(),
        });
        this.message.set('Depoimento cadastrado.');
        this.form.reset();
      }
    } catch (err) {
      console.error('[testimonials.submit]', err);
      this.error.set(this.errorMessage(err, id ? 'atualizar' : 'cadastrar'));
    } finally {
      this.loading.set(false);
    }
  }

  async remove(item: Testimonial) {
    if (!item.id) return;
    const ok = confirm(`Excluir o depoimento de "${item.name}"?`);
    if (!ok) return;

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      await this.testimonials.delete(item.id);
      if (this.editingId() === item.id) this.cancelEdit();
      this.message.set('Depoimento excluído.');
    } catch (err) {
      console.error('[testimonials.remove]', err);
      this.error.set(this.errorMessage(err, 'excluir'));
    } finally {
      this.loading.set(false);
    }
  }

  private errorMessage(err: unknown, action: string): string {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      return (
        'Sem permissão no Firestore. Publique as rules com a coleção testimonials ' +
        '(leitura pública, escrita só admin).'
      );
    }
    return `Não foi possível ${action} o depoimento.`;
  }
}
