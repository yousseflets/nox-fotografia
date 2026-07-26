import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AlbumService } from '../../../core/services/album.service';
import { PhotoService } from '../../../core/services/photo.service';
import { Photo } from '../../../core/models/photo.model';

@Component({
  selector: 'app-admin-album-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './admin-album-detail.component.html',
  styleUrl: './admin-album-detail.component.scss',
})
export class AdminAlbumDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly albums = inject(AlbumService);
  private readonly photos = inject(PhotoService);

  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly message = signal('');

  readonly albumId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly album$ = this.albums.getById(this.albumId);
  readonly photos$ = this.photos.getByAlbum(this.albumId);

  async onFilesSelected(event: Event, clientId: string) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length || !clientId) return;

    this.uploading.set(true);
    this.message.set('');

    try {
      for (const file of files) {
        await this.photos.uploadPhoto(file, this.albumId, clientId, (pct) =>
          this.progress.set(pct)
        );
      }
      this.message.set(`${files.length} foto(s) enviada(s).`);
    } catch {
      this.message.set('Falha no upload. Verifique as regras do Storage e tente novamente.');
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
      input.value = '';
    }
  }

  async remove(photo: Photo) {
    if (!confirm(`Remover ${photo.filename}?`)) return;
    await this.photos.deletePhoto(photo);
  }
}
