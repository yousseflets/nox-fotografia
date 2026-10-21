import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { AlbumService } from '../../../core/services/album.service';
import { PhotoService } from '../../../core/services/photo.service';
import { SaleService } from '../../../core/services/sale.service';
import { Album, isSaleAlbum } from '../../../core/models/album.model';
import { isImageFile, isVideoFile, isVideoPhoto, Photo, photoThumbUrl } from '../../../core/models/photo.model';
import { SalePhoto } from '../../../core/models/sale-photo.model';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { CurrencyBrlInputDirective } from '../../../shared/directives/currency-brl-input.directive';
import {
  ALBUM_PHOTOS_PAGE_SIZE,
  paginateItems,
  totalPages,
} from '../../../core/utils/album-pagination';

@Component({
  selector: 'app-admin-album-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink, ReactiveFormsModule, CurrencyBrlInputDirective],
  templateUrl: './admin-album-detail.component.html',
  styleUrl: './admin-album-detail.component.scss',
})
export class AdminAlbumDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly albums = inject(AlbumService);
  private readonly photos = inject(PhotoService);
  private readonly sales = inject(SaleService);
  private readonly fb = inject(FormBuilder);

  readonly pageSize = ALBUM_PHOTOS_PAGE_SIZE;
  readonly uploading = signal(false);
  readonly deleting = signal(false);
  readonly savingPrice = signal(false);
  readonly progress = signal(0);
  readonly message = signal('');
  readonly loadedIds = signal<Record<string, boolean>>({});
  readonly page = signal(1);

  readonly albumId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly album$ = this.albums.getById(this.albumId);
  readonly photos$ = this.photos.getByAlbum(this.albumId);
  readonly salePhotos$ = this.album$.pipe(
    switchMap((album) =>
      album?.saleEventId ? this.sales.getPhotos(album.saleEventId) : of([] as SalePhoto[])
    )
  );
  readonly allPhotos = toSignal(this.photos$, { initialValue: [] as Photo[] });

  readonly pageCount = computed(() => totalPages(this.allPhotos().length));
  readonly pagedPhotos = computed(() =>
    paginateItems(this.allPhotos(), this.page(), this.pageSize)
  );
  readonly showPager = computed(() => this.allPhotos().length > 0);

  readonly thumbUrl = photoThumbUrl;
  readonly isVideo = isVideoPhoto;
  readonly isSale = isSaleAlbum;
  readonly formatPrice = formatPriceBRL;
  readonly salePreview = this.sales.previewUrl;

  readonly priceForm = this.fb.nonNullable.group({
    priceReais: [15, [Validators.required, Validators.min(1)]],
  });

  private priceSynced = false;

  constructor() {
    this.album$.pipe(takeUntilDestroyed()).subscribe((album) => {
      if (!album || this.priceSynced || !isSaleAlbum(album)) return;
      this.priceSynced = true;
      this.priceForm.patchValue({ priceReais: (album.priceCents || 1500) / 100 });
    });
  }

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

  async savePrice(album: Album) {
    if (!album.saleEventId || this.priceForm.invalid) {
      this.priceForm.markAllAsTouched();
      return;
    }
    const reais = Number(this.priceForm.getRawValue().priceReais);
    if (!Number.isFinite(reais) || reais < 1) {
      this.message.set('Informe um preço de pelo menos R$ 1,00 por foto.');
      return;
    }
    const priceCents = Math.round(reais * 100);
    this.savingPrice.set(true);
    this.message.set('');
    try {
      await this.sales.updateEvent(album.saleEventId, { priceCents });
      await this.albums.update(this.albumId, { priceCents });
      this.message.set('Preço por foto atualizado.');
    } catch {
      this.message.set('Não foi possível salvar o preço.');
    } finally {
      this.savingPrice.set(false);
    }
  }

  async onSaleFilesSelected(event: Event, album: Album) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter((file) => isImageFile(file));
    if (!album.saleEventId) return;
    if (!files.length) {
      this.message.set('Selecione fotos para vender.');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.message.set('');
    try {
      let cover = album.coverUrl;
      for (const file of files) {
        const photo = await this.sales.uploadPhoto(file, album.saleEventId, (pct) =>
          this.progress.set(pct)
        );
        if (!cover && photo.previewUrl) {
          cover = photo.thumbUrl || photo.previewUrl;
          await this.albums.update(this.albumId, { coverUrl: cover });
          await this.sales.ensureCover(album.saleEventId, photo.previewUrl);
        }
      }
      this.message.set(`${files.length} foto(s) enviada(s) com marca d'água.`);
    } catch {
      this.message.set('Falha no upload. Verifique as regras do Storage e tente novamente.');
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
      input.value = '';
    }
  }

  async rebuildSaleMarks(album: Album) {
    if (!album.saleEventId) return;
    const photos = await firstValueFrom(this.sales.getPhotos(album.saleEventId));
    if (!photos.length) {
      this.message.set('Não há fotos para atualizar.');
      return;
    }

    this.uploading.set(true);
    this.message.set('');
    try {
      let cover = '';
      for (const photo of photos) {
        const updated = await this.sales.rebuildPreview(photo);
        if (!cover) cover = updated.thumbUrl || updated.previewUrl;
      }
      if (cover) {
        await this.albums.update(this.albumId, { coverUrl: cover });
        await this.sales.ensureCover(album.saleEventId, cover);
      }
      this.message.set('Marcas d\'água atualizadas. Abra o álbum do cliente de novo.');
    } catch {
      this.message.set('Não foi possível atualizar as marcas d\'água.');
    } finally {
      this.uploading.set(false);
    }
  }

  async removeSale(photo: SalePhoto, album: Album) {
    if (!confirm(`Remover ${photo.filename}?`)) return;
    await this.sales.deletePhoto(photo);
    if (!album.saleEventId) return;
    const wasCover =
      !!album.coverUrl &&
      (album.coverUrl === photo.previewUrl || album.coverUrl === photo.thumbUrl);
    if (!wasCover) return;
    const remaining = await firstValueFrom(this.sales.getPhotos(album.saleEventId));
    const next = remaining.find((item) => item.id !== photo.id);
    const cover = next?.thumbUrl || next?.previewUrl || '';
    await this.albums.update(this.albumId, { coverUrl: cover });
    if (cover) await this.sales.ensureCover(album.saleEventId, next?.previewUrl || cover);
  }

  async onFilesSelected(event: Event, clientId: string) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []).filter(
      (file) => isImageFile(file) || isVideoFile(file)
    );
    if (!files.length || !clientId) {
      this.message.set('Selecione fotos ou vídeos.');
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.message.set('');

    try {
      let lastPhoto: Photo | null = null;
      let images = 0;
      let videos = 0;
      for (const file of files) {
        lastPhoto = await this.photos.uploadPhoto(file, this.albumId, clientId, (pct) =>
          this.progress.set(pct)
        );
        if (isVideoFile(file)) videos += 1;
        else images += 1;
      }
      await this.ensureCover(lastPhoto);
      this.message.set(this.uploadSummary(images, videos));
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
      'Excluir o álbum "' + title + '"?\nTodas as fotos e vídeos deste álbum também serão removidos.'
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

  private uploadSummary(images: number, videos: number): string {
    const parts: string[] = [];
    if (images) parts.push(`${images} foto(s)`);
    if (videos) parts.push(`${videos} vídeo(s)`);
    return `${parts.join(' e ')} enviado(s).`;
  }

  private async ensureCover(photo: Photo | null) {
    if (!photo) return;
    const album = await firstValueFrom(this.albums.getById(this.albumId));
    if (!album || album.coverUrl) return;
    const cover = isVideoPhoto(photo) ? photo.thumbUrl : photoThumbUrl(photo);
    if (!cover) return;
    await this.albums.update(this.albumId, { coverUrl: cover });
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
