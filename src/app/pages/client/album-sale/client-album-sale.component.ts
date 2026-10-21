import { Component, DestroyRef, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { saveAs } from 'file-saver';
import { Album } from '../../../core/models/album.model';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { SalePhoto } from '../../../core/models/sale-photo.model';
import { CartService } from '../../../core/services/cart.service';
import { SaleService } from '../../../core/services/sale.service';

@Component({
  selector: 'app-client-album-sale',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './client-album-sale.component.html',
  styleUrl: './client-album-sale.component.scss',
})
export class ClientAlbumSaleComponent {
  private readonly sales = inject(SaleService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly cart = inject(CartService);

  readonly album = input.required<Album>();
  readonly formatPrice = formatPriceBRL;
  readonly preview = this.sales.previewUrl;
  readonly selected = signal<Record<string, boolean>>({});
  readonly viewerIndex = signal<number | null>(null);
  readonly purchases = signal<Record<string, { filename: string; url: string }>>({});
  readonly downloadingId = signal<string | null>(null);
  private loadedAlbumId = '';

  readonly photos = toSignal(
    toObservable(this.album).pipe(
      switchMap((album) =>
        album.saleEventId ? this.sales.getPhotos(album.saleEventId) : of([] as SalePhoto[])
      )
    ),
    { initialValue: [] as SalePhoto[] }
  );

  readonly selectedCount = computed(
    () => Object.values(this.selected()).filter(Boolean).length
  );
  readonly selectedTotal = computed(() => this.selectedCount() * (this.album().priceCents || 0));

  readonly viewer = computed(() => {
    const index = this.viewerIndex();
    if (index === null) return null;
    const list = this.photos();
    const photo = list[index];
    if (!photo) return null;
    return {
      index,
      photo,
      total: list.length,
      isFirst: index <= 0,
      isLast: index >= list.length - 1,
    };
  });

  constructor() {
    effect(() => {
      document.body.style.overflow = this.viewer() ? 'hidden' : '';
    });
    effect(() => {
      const albumId = this.album().id ?? '';
      if (!albumId || albumId === this.loadedAlbumId) return;
      this.loadedAlbumId = albumId;
      void this.loadPurchases(albumId);
    });
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  imageUrl(photo: SalePhoto): string {
    if (!photo.id) return this.preview(photo);
    return this.purchases()[photo.id]?.url || this.preview(photo);
  }

  isPaid(photo: SalePhoto): boolean {
    return !!photo.id && !!this.purchases()[photo.id];
  }

  async download(photo: SalePhoto) {
    const file = photo.id ? this.purchases()[photo.id] : undefined;
    if (!file || this.downloadingId()) return;
    this.downloadingId.set(photo.id || file.filename);
    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      saveAs(await response.blob(), file.filename || photo.filename);
    } catch (err) {
      console.error('[album-sale.download]', err);
      alert('Não foi possível baixar esta foto. Tente novamente.');
    } finally {
      this.downloadingId.set(null);
    }
  }

  private async loadPurchases(albumId: string) {
    try {
      const files = await this.sales.getAlbumPurchases(albumId);
      const map: Record<string, { filename: string; url: string }> = {};
      for (const file of files) {
        if (file.photoId && file.url) map[file.photoId] = file;
      }
      this.purchases.set(map);
    } catch (err) {
      console.error('[album-sale.purchases]', err);
    }
  }

  openViewer(photo: SalePhoto) {
    const index = this.photos().findIndex((item) => item.id === photo.id);
    if (index < 0) return;
    this.viewerIndex.set(index);
  }

  closeViewer() {
    this.viewerIndex.set(null);
  }

  prevPhoto() {
    const index = this.viewerIndex();
    if (index === null || index <= 0) return;
    this.viewerIndex.set(index - 1);
  }

  nextPhoto() {
    const index = this.viewerIndex();
    if (index === null || index >= this.photos().length - 1) return;
    this.viewerIndex.set(index + 1);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    if (this.viewerIndex() === null) return;
    if (event.key === 'Escape') this.closeViewer();
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prevPhoto();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextPhoto();
    }
  }

  toggle(photo: SalePhoto) {
    if (!photo.id || this.isPaid(photo)) return;
    this.selected.update((map) => ({ ...map, [photo.id!]: !map[photo.id!] }));
  }

  isSelected(photo: SalePhoto) {
    return !!photo.id && !!this.selected()[photo.id];
  }

  addSelectedToCart() {
    const album = this.album();
    if (!album.saleEventId || !album.priceCents) return;
    const items = this.photos()
      .filter((photo) => photo.id && this.selected()[photo.id] && !this.isPaid(photo))
      .map((photo) => ({
        photoId: photo.id!,
        eventId: album.saleEventId!,
        filename: photo.filename,
        previewUrl: this.preview(photo),
        priceCents: album.priceCents!,
      }));
    this.cart.addMany(items);
    void this.router.navigateByUrl('/carrinho');
  }

  buyOne(photo: SalePhoto) {
    const album = this.album();
    if (!album.saleEventId || !album.priceCents || !photo.id || this.isPaid(photo)) return;
    this.cart.add({
      photoId: photo.id,
      eventId: album.saleEventId,
      filename: photo.filename,
      previewUrl: this.preview(photo),
      priceCents: album.priceCents,
    });
    void this.router.navigateByUrl('/carrinho');
  }
}
