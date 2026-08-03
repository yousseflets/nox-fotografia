import { Component, HostListener, OnDestroy, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { GalleryService } from '../../../../core/services/gallery.service';
import {
  GalleryImage as StoredGalleryImage,
  galleryDisplayUrl,
} from '../../../../core/models/gallery-image.model';

type GalleryImage = { src: string; fullSrc: string; alt: string; id?: string };

const FALLBACK: GalleryImage[] = [
  { src: '/carrossel-1.jpeg', fullSrc: '/carrossel-1.jpeg', alt: 'Ensaio NOX Fotografia 1' },
  { src: '/carrossel-2.jpeg', fullSrc: '/carrossel-2.jpeg', alt: 'Ensaio NOX Fotografia 2' },
  { src: '/carrossel-3.jpeg', fullSrc: '/carrossel-3.jpeg', alt: 'Ensaio NOX Fotografia 3' },
  { src: '/carrossel-4.jpeg', fullSrc: '/carrossel-4.jpeg', alt: 'Ensaio NOX Fotografia 4' },
  { src: '/carrossel-5.jpeg', fullSrc: '/carrossel-5.jpeg', alt: 'Ensaio NOX Fotografia 5' },
  { src: '/carrossel-6.jpeg', fullSrc: '/carrossel-6.jpeg', alt: 'Ensaio NOX Fotografia 6' },
];

@Component({
  selector: 'app-gallery-carousel',
  standalone: true,
  templateUrl: './gallery-carousel.component.html',
  styleUrl: './gallery-carousel.component.scss',
})
export class GalleryCarouselComponent implements OnDestroy {
  private readonly gallery = inject(GalleryService);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly preloaded = new Set<string>();

  readonly index = signal(0);
  readonly preview = signal<GalleryImage | null>(null);
  readonly loadedIds = signal<Record<string, boolean>>({});
  readonly viewportWidth = signal(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  readonly images = toSignal(
    this.gallery.getAll().pipe(
      map((list: StoredGalleryImage[]) =>
        list.length
          ? list.map((item) => ({
              id: item.id,
              src: galleryDisplayUrl(item),
              fullSrc: item.url,
              alt: item.alt || 'Ensaio NOX Fotografia',
            }))
          : FALLBACK
      )
    ),
    { initialValue: FALLBACK }
  );

  constructor() {
    effect(() => {
      const list = this.images();
      const total = list.length;
      if (!total) {
        this.stop();
        return;
      }
      if (this.index() >= total) this.index.set(0);
      this.preloadAround(this.index());
      if (!this.preview()) this.start();
    });
  }

  ngOnDestroy() {
    this.stop();
  }

  start() {
    if (this.preview()) return;
    const total = this.images().length;
    if (total <= 1) return;
    this.stop();
    this.timer = setInterval(() => {
      this.preloadAround(this.index());
      this.next();
    }, 4000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  next() {
    const total = this.images().length;
    if (!total) return;
    this.index.update((i) => (i + 1) % total);
    this.preloadAround(this.index());
  }

  prev() {
    const total = this.images().length;
    if (!total) return;
    this.index.update((i) => (i - 1 + total) % total);
    this.preloadAround(this.index());
  }

  goTo(i: number) {
    this.index.set(i);
    this.preloadAround(i);
    this.start();
  }

  openPreview(image: GalleryImage) {
    this.preview.set(image);
    this.stop();
  }

  closePreview() {
    this.preview.set(null);
    this.start();
  }

  markLoaded(key: string | undefined) {
    if (!key) return;
    this.loadedIds.update((map) => ({ ...map, [key]: true }));
  }

  imageKey(image: GalleryImage): string {
    return image.id || image.src;
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.preview()) this.closePreview();
  }

  @HostListener('window:resize')
  onResize() {
    this.viewportWidth.set(window.innerWidth);
    this.preloadAround(this.index());
  }

  visibleCount() {
    const width = this.viewportWidth();
    if (width <= 600) return 1;
    if (width <= 900) return 2;
    return 3;
  }

  visibleImages() {
    const list = this.images();
    const total = list.length;
    if (!total) return [];
    const count = Math.min(this.visibleCount(), total);
    if (total <= count) return list;
    const start = this.index();
    return Array.from({ length: count }, (_, offset) => list[(start + offset) % total]);
  }

  private preloadAround(start: number) {
    const list = this.images();
    const total = list.length;
    if (!total) return;
    const span = this.visibleCount() + 2;
    for (let offset = -1; offset < span; offset++) {
      const item = list[(start + offset + total) % total];
      this.preload(item.src);
    }
  }

  private preload(src: string) {
    if (!src || this.preloaded.has(src)) return;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => this.preloaded.add(src);
    img.onerror = () => this.preloaded.add(src);
    img.src = src;
  }
}
