import { Component, HostListener, OnDestroy, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { GalleryService } from '../../../../core/services/gallery.service';
import { GalleryImage as StoredGalleryImage } from '../../../../core/models/gallery-image.model';

type GalleryImage = { src: string; alt: string; id?: string };

const FALLBACK: GalleryImage[] = [
  { src: '/carrossel-1.jpeg', alt: 'Ensaio NOX Fotografia 1' },
  { src: '/carrossel-2.jpeg', alt: 'Ensaio NOX Fotografia 2' },
  { src: '/carrossel-3.jpeg', alt: 'Ensaio NOX Fotografia 3' },
  { src: '/carrossel-4.jpeg', alt: 'Ensaio NOX Fotografia 4' },
  { src: '/carrossel-5.jpeg', alt: 'Ensaio NOX Fotografia 5' },
  { src: '/carrossel-6.jpeg', alt: 'Ensaio NOX Fotografia 6' },
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

  readonly index = signal(0);
  readonly preview = signal<GalleryImage | null>(null);
  readonly viewportWidth = signal(
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  readonly images = toSignal(
    this.gallery.getAll().pipe(
      map((list: StoredGalleryImage[]) =>
        list.length
          ? list.map((item) => ({
              id: item.id,
              src: item.url,
              alt: item.alt || 'Ensaio NOX Fotografia',
            }))
          : FALLBACK
      )
    ),
    { initialValue: FALLBACK }
  );

  constructor() {
    effect(() => {
      const total = this.images().length;
      if (!total) {
        this.stop();
        return;
      }
      if (this.index() >= total) this.index.set(0);
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
    this.timer = setInterval(() => this.next(), 4000);
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
  }

  prev() {
    const total = this.images().length;
    if (!total) return;
    this.index.update((i) => (i - 1 + total) % total);
  }

  goTo(i: number) {
    this.index.set(i);
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

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.preview()) this.closePreview();
  }

  @HostListener('window:resize')
  onResize() {
    this.viewportWidth.set(window.innerWidth);
  }

  private visibleCount() {
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
}
