import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseError } from 'firebase/app';
import { switchMap, of, merge } from 'rxjs';
import { PortfolioService } from '../../../core/services/portfolio.service';
import { PortfolioCategory, PortfolioPhoto } from '../../../core/models/portfolio.model';

@Component({
  selector: 'app-admin-portfolio-photos',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe],
  templateUrl: './admin-portfolio-photos.component.html',
  styleUrl: './admin-portfolio-photos.component.scss',
})
export class AdminPortfolioPhotosComponent {
  private readonly fb = inject(FormBuilder);
  private readonly portfolio = inject(PortfolioService);

  readonly categories = toSignal(this.portfolio.getCategories(), { initialValue: [] as PortfolioCategory[] });
  readonly selectedCategoryId = signal('');
  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly message = signal('');
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    categoryId: ['', Validators.required],
    alt: [''],
  });

  readonly photos$ = merge(
    of(this.form.controls.categoryId.value),
    this.form.controls.categoryId.valueChanges
  ).pipe(
    switchMap((id) => {
      this.selectedCategoryId.set(id || '');
      return id ? this.portfolio.getPhotosByCategory(id) : of([] as PortfolioPhoto[]);
    })
  );

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    if (this.form.controls.categoryId.invalid) {
      this.form.controls.categoryId.markAsTouched();
      this.error.set('Selecione uma categoria.');
      input.value = '';
      return;
    }

    const categoryId = this.form.controls.categoryId.value;
    const category = this.categories().find((c) => c.id === categoryId);
    if (!category) {
      this.error.set('Categoria não encontrada.');
      return;
    }

    this.uploading.set(true);
    this.message.set('');
    this.error.set('');
    const alt = this.form.controls.alt.value.trim();
    let uploaded = 0;

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        await this.portfolio.uploadPhoto(file, category, alt, (pct) => this.progress.set(pct));
        uploaded += 1;
      }
      this.message.set(
        uploaded
          ? `${uploaded} foto(s) enviada(s) para ${category.title}.`
          : 'Selecione ao menos uma imagem válida.'
      );
    } catch (err) {
      console.error(err);
      this.error.set(this.errMsg(err));
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
      input.value = '';
    }
  }

  async remove(photo: PortfolioPhoto) {
    if (!confirm('Remover esta foto?')) return;
    try {
      await this.portfolio.deletePhoto(photo);
      this.message.set('Foto removida.');
    } catch (err) {
      console.error(err);
      this.error.set(this.errMsg(err, 'remover'));
    }
  }

  private errMsg(err: unknown, action = 'enviar') {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      return 'Sem permissão. Publique as rules do Firestore e Storage do portfólio.';
    }
    return `Não foi possível ${action} a foto.`;
  }
}
