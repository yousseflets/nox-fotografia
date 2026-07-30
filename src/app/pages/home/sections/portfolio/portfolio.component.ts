import { Component, HostListener, OnDestroy, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PortfolioService } from '../../../../core/services/portfolio.service';
import {
  DEFAULT_PORTFOLIO_CATEGORIES,
  PortfolioCategory,
  isCategoryActive,
} from '../../../../core/models/portfolio.model';

/** Quantidade máxima na grade antes de virar carrossel. */
const MAX_VISIBLE = 4;

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
})
export class PortfolioComponent implements OnDestroy {
  private readonly portfolio = inject(PortfolioService);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly index = signal(0);

  readonly items = toSignal(
    this.portfolio.getCategories().pipe(
      map((list) => {
        if (!list.length) {
          return DEFAULT_PORTFOLIO_CATEGORIES.map((item) => ({
            ...item,
            active: true,
            createdAt: '',
          })) as PortfolioCategory[];
        }
        return list.filter(isCategoryActive);
      })
    ),
    {
      initialValue: DEFAULT_PORTFOLIO_CATEGORIES.map((item) => ({
        ...item,
        active: true,
        createdAt: '',
      })) as PortfolioCategory[],
    }
  );

  constructor() {
    effect(() => {
      const list = this.items();
      if (!this.isCarousel()) {
        this.stop();
        this.index.set(0);
        return;
      }
      if (this.index() >= list.length) this.index.set(0);
      this.start();
    });
  }

  ngOnDestroy() {
    this.stop();
  }

  isCarousel() {
    return this.items().length > MAX_VISIBLE;
  }

  visibleItems() {
    const list = this.items();
    if (!this.isCarousel()) return list;
    const total = list.length;
    const start = this.index();
    const count = Math.min(MAX_VISIBLE, total);
    return Array.from({ length: count }, (_, offset) => list[(start + offset) % total]);
  }

  next() {
    const total = this.items().length;
    if (!total) return;
    this.index.update((i) => (i + 1) % total);
    this.start();
  }

  prev() {
    const total = this.items().length;
    if (!total) return;
    this.index.update((i) => (i - 1 + total) % total);
    this.start();
  }

  goTo(i: number) {
    this.index.set(i);
    this.start();
  }

  start() {
    if (!this.isCarousel()) return;
    this.stop();
    this.timer = setInterval(() => this.next(), 4500);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  @HostListener('window:resize')
  onResize() {
    // reinicia autoplay ao mudar viewport
    if (this.isCarousel()) this.start();
  }
}
