import { AsyncPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { FirebaseError } from 'firebase/app';
import { GalleryService } from '../../../core/services/gallery.service';
import { GalleryImage, galleryDisplayUrl } from '../../../core/models/gallery-image.model';

@Component({
  selector: 'app-admin-gallery',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe],
  templateUrl: './admin-gallery.component.html',
  styleUrl: './admin-gallery.component.scss',
})
export class AdminGalleryComponent {
  private readonly fb = inject(FormBuilder);
  private readonly gallery = inject(GalleryService);

  readonly list$ = this.gallery.getAll();
  readonly uploading = signal(false);
  readonly optimizing = signal(false);
  readonly progress = signal(0);
  readonly message = signal('');
  readonly error = signal('');

  readonly displayUrl = galleryDisplayUrl;

  readonly form = this.fb.nonNullable.group({
    alt: [''],
  });

  async onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    this.uploading.set(true);
    this.message.set('');
    this.error.set('');

    const alt = this.form.controls.alt.value.trim();
    let uploaded = 0;

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        await this.gallery.upload(file, alt, (pct) => this.progress.set(pct));
        uploaded += 1;
      }
      if (!uploaded) {
        this.error.set('Selecione ao menos uma imagem válida.');
      } else {
        this.message.set(`${uploaded} foto(s) adicionada(s) à galeria.`);
        this.form.reset();
      }
    } catch (err) {
      console.error('[admin-gallery.upload]', err);
      this.error.set(this.errorMessage(err));
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
      input.value = '';
    }
  }

  async optimize() {
    this.optimizing.set(true);
    this.message.set('');
    this.error.set('');
    try {
      const total = await this.gallery.generateMissingThumbnails((done, all) => {
        this.progress.set(all ? (done / all) * 100 : 0);
      });
      this.message.set(
        total
          ? `${total} foto(s) otimizada(s) para carregar mais rápido na home.`
          : 'Todas as fotos já estão otimizadas.'
      );
    } catch (err) {
      console.error('[admin-gallery.optimize]', err);
      this.error.set(this.errorMessage(err, 'otimizar'));
    } finally {
      this.optimizing.set(false);
      this.progress.set(0);
    }
  }

  async remove(image: GalleryImage) {
    const ok = confirm('Remover esta foto da galeria?');
    if (!ok) return;

    this.error.set('');
    this.message.set('');
    try {
      await this.gallery.delete(image);
      this.message.set('Foto removida.');
    } catch (err) {
      console.error('[admin-gallery.remove]', err);
      this.error.set(this.errorMessage(err, 'remover'));
    }
  }

  private errorMessage(err: unknown, action = 'enviar'): string {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      return (
        'Sem permissão. Publique as rules do Firestore (gallery) e do Storage (gallery/{file}).'
      );
    }
    return `Não foi possível ${action} a foto.`;
  }
}
