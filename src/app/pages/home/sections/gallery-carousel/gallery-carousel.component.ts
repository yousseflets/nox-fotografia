import { Component, HostListener, OnDestroy, OnInit, signal } from '@angular/core';

type GalleryImage = { src: string; alt: string };

@Component({
  selector: 'app-gallery-carousel',
  standalone: true,
  templateUrl: './gallery-carousel.component.html',
  styleUrl: './gallery-carousel.component.scss',
})
export class GalleryCarouselComponent implements OnInit, OnDestroy {
  readonly index = signal(0);
  readonly preview = signal<GalleryImage | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly images: GalleryImage[] = [
    { src: '/carrossel-1.jpeg', alt: 'Ensaio NOX Fotografia 1' },
    { src: '/carrossel-2.jpeg', alt: 'Ensaio NOX Fotografia 2' },
    { src: '/carrossel-3.jpeg', alt: 'Ensaio NOX Fotografia 3' },
    { src: '/carrossel-4.jpeg', alt: 'Ensaio NOX Fotografia 4' },
    { src: '/carrossel-5.jpeg', alt: 'Ensaio NOX Fotografia 5' },
    { src: '/carrossel-6.jpeg', alt: 'Ensaio NOX Fotografia 6' },
  ];

  ngOnInit() {
    this.start();
  }

  ngOnDestroy() {
    this.stop();
  }

  start() {
    if (this.preview()) return;
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
    this.index.update((i) => (i + 1) % this.images.length);
  }

  prev() {
    this.index.update((i) => (i - 1 + this.images.length) % this.images.length);
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

  visibleImages() {
    const total = this.images.length;
    const start = this.index();
    return [0, 1, 2].map((offset) => this.images[(start + offset) % total]);
  }
}
