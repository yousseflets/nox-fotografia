import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AlbumService } from '../../../core/services/album.service';
import { PhotoService } from '../../../core/services/photo.service';
import { Photo, photoThumbUrl } from '../../../core/models/photo.model';
import {
  ALBUM_PHOTOS_PAGE_SIZE,
  paginateItems,
  totalPages,
} from '../../../core/utils/album-pagination';

@Component({
  selector: 'app-admin-album-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './admin-album-detail.component.html',
  styleUrl: './admin-album-detail.component.scss',
})
export class AdminAlbumDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly albums = inject(AlbumService);
  private readonly photos = inject(PhotoService);

  readonly pageSize = ALBUM_PHOTOS_PAGE_SIZE;
  readonly uploading = signal(false);
  readonly deleting = signal(false);
  readonly progress = signal(0);
  readonly message = signal('');
  readonly loadedIds = signal<Record<string, boolean>>({});
  readonly page = signal(1);

  readonly albumId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly album$ = this.albums.getById(this.albumId);
  readonly photos$ = this.photos.getByAlbum(this.albumId);
  readonly allPhotos = toSignal(this.photos$, { initialValue: [] as Photo[] });

  readonly pageCount = computed(() => totalPages(this.allPhotos().length));
  readonly pagedPhotos = computed(() =>
    paginateItems(this.allPhotos(), this.page(), this.pageSize)
  );
  readonly showPager = computed(() => this.allPhotos().length > 0);

  readonly thumbUrl = photoThumbUrl;

  markLoaded(id: string | undefined) {
    if (!id) return;
    this.loadedIds.update((map) => ({ ...map, [id]: true }));
  }

  photoNumber(indexOnPage: number): number {
    return (this.page() - 1) * this.pageSize + indexOnPage + 1;
  }

  goToPage(page: number) {
    const max = this.pageCount();
    if (!max) return;
    this.page.set(Math.min(max, Math.max(1, page)));
  }

  async onFilesSelected(event: Event, clientId: string) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length || !clientId) return;

    this.uploading.set(true);
    this.message.set('');

    try {
      let lastPhoto: Photo | null = null;
      for (const file of files) {
        lastPhoto = await this.photos.uploadPhoto(file, this.albumId, clientId, (pct) =>
          this.progress.set(pct)
        );
      }
      await this.ensureCover(lastPhoto);
      this.message.set(`${files.length} foto(s) enviada(s).`);
      this.page.set(1);
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
    await this.refreshCoverAfterDelete(photo);
    if (this.page() > this.pageCount() && this.pageCount() > 0) {
      this.page.set(this.pageCount());
    }
  }

  async deleteAlbum(title: string) {
    const ok = confirm(
      'Excluir o álbum "' + title + '"?\nTodas as fotos deste álbum também serão removidas.'
    );
    if (!ok) return;

    this.deleting.set(true);
    this.message.set('');

    try {
      await this.albums.deleteAlbum(this.albumId);
      await this.router.navigateByUrl('/admin/albuns');
    } catch {
      this.message.set('Não foi possível excluir o álbum.');
      this.deleting.set(false);
    }
  }

  private async ensureCover(photo: Photo | null) {
    if (!photo) return;
    const album = await firstValueFrom(this.albums.getById(this.albumId));
    if (!album || album.coverUrl) return;
    await this.albums.update(this.albumId, { coverUrl: photoThumbUrl(photo) });
  }

  private async refreshCoverAfterDelete(removed: Photo) {
    const album = await firstValueFrom(this.albums.getById(this.albumId));
    if (!album) return;
    const cover = album.coverUrl;
    const wasCover =
      !!cover &&
      (cover === removed.url || cover === removed.thumbUrl || cover === photoThumbUrl(removed));
    if (!wasCover && cover) return;
    const next = await this.photos.getAlbumCoverUrl(this.albumId);
    await this.albums.update(this.albumId, { coverUrl: next || '' });
  }
}
