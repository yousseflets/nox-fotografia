import { Component, DestroyRef, HostListener, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map, startWith } from 'rxjs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AlbumService } from '../../../core/services/album.service';
import { PhotoService } from '../../../core/services/photo.service';
import { Photo, photoDisplayUrl, photoThumbUrl } from '../../../core/models/photo.model';
import {
  ALBUM_PHOTOS_PAGE_SIZE,
  paginateItems,
  totalPages,
} from '../../../core/utils/album-pagination';

@Component({
  selector: 'app-client-album-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './client-album-detail.component.html',
  styleUrl: './client-album-detail.component.scss',
})
export class ClientAlbumDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly albums = inject(AlbumService);
  private readonly photos = inject(PhotoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = ALBUM_PHOTOS_PAGE_SIZE;
  readonly albumId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly zipping = signal(false);
  readonly downloadingId = signal<string | null>(null);
  readonly loadedIds = signal<Record<string, boolean>>({});
  readonly page = signal(1);
  readonly viewerIndex = signal<number | null>(null);
  readonly fullReadyIds = signal<Record<string, boolean>>({});
  private swipeStartX = 0;
  private readonly preloadedUrls = new Set<string>();

  readonly album$ = this.albums.getById(this.albumId);
  readonly photos$ = this.photos.getByAlbum(this.albumId);
  readonly photosState = toSignal(
    this.photos$.pipe(
      map((photos) => ({ ready: true as const, photos })),
      startWith({ ready: false as const, photos: [] as Photo[] })
    ),
    { initialValue: { ready: false as const, photos: [] as Photo[] } }
  );

  readonly allPhotos = computed(() => this.photosState().photos);
  readonly photosReady = computed(() => this.photosState().ready);

  readonly pageCount = computed(() => totalPages(this.allPhotos().length));
  readonly pagedPhotos = computed(() =>
    paginateItems(this.allPhotos(), this.page(), this.pageSize)
  );
  readonly showPager = computed(() => this.allPhotos().length > 0);

  readonly viewer = computed(() => {
    const index = this.viewerIndex();
    if (index === null) return null;
    const list = this.allPhotos();
    const photo = list[index];
    if (!photo) return null;
    const id = photo.id || photo.storagePath || String(index);
    const thumb = photoThumbUrl(photo);
    const display = photoDisplayUrl(photo);
    return {
      index,
      photo,
      id,
      total: list.length,
      isFirst: index <= 0,
      isLast: index >= list.length - 1,
      thumb,
      display,
      fullReady: this.fullReadyIds()[id] === true,
    };
  });

  readonly filmstrip = computed(() => {
    const view = this.viewer();
    if (!view) return [];
    const list = this.allPhotos();
    const size = Math.min(9, list.length);
    let start = Math.max(0, view.index - Math.floor(size / 2));
    const end = Math.min(list.length, start + size);
    start = Math.max(0, end - size);
    return list.slice(start, end).map((photo, offset) => {
      const index = start + offset;
      return {
        photo,
        index,
        active: index === view.index,
      };
    });
  });

  readonly thumbUrl = photoThumbUrl;

  constructor() {
    effect(() => {
      const view = this.viewer();
      document.body.style.overflow = view ? 'hidden' : '';
      if (view) this.preloadAround(view.index);
    });
    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
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

  openViewer(indexOnPage: number) {
    this.goToViewerPhoto(this.photoNumber(indexOnPage) - 1);
  }

  goToViewerPhoto(index: number, event?: Event) {
    event?.stopPropagation();
    if (index < 0 || index >= this.allPhotos().length) return;
    this.viewerIndex.set(index);
    this.syncPageToViewer();
  }

  markFullReady(id: string) {
    this.fullReadyIds.update((map) => (map[id] ? map : { ...map, [id]: true }));
  }

  closeViewer() {
    this.viewerIndex.set(null);
  }

  prevPhoto() {
    const index = this.viewerIndex();
    if (index === null || index <= 0) return;
    this.viewerIndex.set(index - 1);
    this.syncPageToViewer();
  }

  nextPhoto() {
    const index = this.viewerIndex();
    if (index === null) return;
    if (index >= this.allPhotos().length - 1) return;
    this.viewerIndex.set(index + 1);
    this.syncPageToViewer();
  }

  onViewerPointerDown(event: PointerEvent) {
    this.swipeStartX = event.clientX;
  }

  onViewerPointerUp(event: PointerEvent) {
    const dx = event.clientX - this.swipeStartX;
    if (dx > 56) this.prevPhoto();
    else if (dx < -56) this.nextPhoto();
  }

  photoBusy(photo: Photo): boolean {
    const id = photo.id || photo.storagePath;
    return this.zipping() || this.downloadingId() === id;
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

  private preloadAround(index: number) {
    const list = this.allPhotos();
    for (const offset of [-1, 1, 2]) {
      const photo = list[index + offset];
      if (!photo) continue;
      const url = photoDisplayUrl(photo);
      if (this.preloadedUrls.has(url)) continue;
      this.preloadedUrls.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  }

  private syncPageToViewer() {
    const index = this.viewerIndex();
    if (index === null) return;
    const page = Math.floor(index / this.pageSize) + 1;
    if (this.page() !== page) this.page.set(page);
  }

  async downloadOne(photo: Photo, index = 0) {
    const id = photo.id ?? photo.storagePath ?? String(index);
    this.downloadingId.set(id);

    try {
      const bytes = await this.photos.getPhotoBytes(photo);
      const name = photo.filename || `foto-${index + 1}.jpg`;
      const blob = new Blob([bytes], { type: this.mimeFromName(name) });
      saveAs(blob, name);
    } catch (err) {
      console.error('[downloadOne]', err);
      alert('NÃ£o foi possÃ­vel baixar esta foto. Tente novamente.');
    } finally {
      this.downloadingId.set(null);
    }
  }

  async downloadAll(photos: Photo[], albumTitle: string) {
    if (!photos.length) return;
    this.zipping.set(true);

    try {
      const zip = new JSZip();
      const folderName =
        (albumTitle || 'album').replace(/[^\w\- ]+/g, '').trim() || 'album';
      const folder = zip.folder(folderName);
      const usedNames = new Set<string>();

      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        const bytes = await this.photos.getPhotoBytes(photo);
        let name = photo.filename || `foto-${index + 1}.jpg`;
        if (usedNames.has(name)) {
          const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
          const baseName = ext ? name.slice(0, -ext.length) : name;
          name = `${baseName}-${index + 1}${ext}`;
        }
        usedNames.add(name);
        folder?.file(name, bytes, {
          binary: true,
          compression: 'STORE',
        });
      }

      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE',
      });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      console.error('[downloadAll]', err);
      alert('NÃ£o foi possÃ­vel gerar o ZIP. Tente baixar as fotos individualmente.');
    } finally {
      this.zipping.set(false);
    }
  }

  private mimeFromName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  }
}
