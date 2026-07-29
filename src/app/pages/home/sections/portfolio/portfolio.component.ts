import { Component, HostListener, OnDestroy, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PortfolioService } from '../../../../core/services/portfolio.service';
import {
  DEFAULT_PORTFOLIO_CATEGORIES,
  PortfolioCategory,
} from '../../../../core/models/portfolio.model';

const DEFAULT_COUNT = DEFAULT_PORTFOLIO_CATEGORIES.length;
const VISIBLE_DESKTOP = 6;

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
      map((list) =>
        list.length
          ? list
          : (DEFAULT_PORTFOLIO_CATEGORIES.map((item) => ({
              ...item,
              createdAt: '',
            })) as PortfolioCategory[])
      )
    ),
    {
      initialValue: DEFAULT_PORTFOLIO_CATEGORIES.map((item) => ({
        ...item,
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
    return this.items().length > DEFAULT_COUNT;
  }

  visibleItems() {
    const list = this.items();
    if (!this.isCarousel()) return list;
    const total = list.length;
    const start = this.index();
    const count = Math.min(VISIBLE_DESKTOP, total);
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
