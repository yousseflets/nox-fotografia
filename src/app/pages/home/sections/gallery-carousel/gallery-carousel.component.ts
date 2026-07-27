import { Component, OnDestroy, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-gallery-carousel',
  standalone: true,
  templateUrl: './gallery-carousel.component.html',
  styleUrl: './gallery-carousel.component.scss',
})
export class GalleryCarouselComponent implements OnInit, OnDestroy {
  readonly index = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly images = [
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

  /** Retorna 3 fotos consecutivas a partir do índice atual (loop). */
  visibleImages() {
    const total = this.images.length;
    const start = this.index();
    return [0, 1, 2].map((offset) => this.images[(start + offset) % total]);
  }
}
