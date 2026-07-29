import { AsyncPipe } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, of, switchMap } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PortfolioService } from '../../core/services/portfolio.service';
import {
  DEFAULT_PORTFOLIO_CATEGORIES,
  PortfolioCategory,
  PortfolioPhoto,
} from '../../core/models/portfolio.model';

@Component({
  selector: 'app-portfolio-category',
  standalone: true,
  imports: [AsyncPipe, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './portfolio-category.component.html',
  styleUrl: './portfolio-category.component.scss',
})
export class PortfolioCategoryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly portfolio = inject(PortfolioService);

  readonly preview = signal<PortfolioPhoto | null>(null);

  readonly slug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('slug') || '')),
    { initialValue: '' }
  );

  readonly category$ = this.route.paramMap.pipe(
    map((p) => p.get('slug') || ''),
    switchMap((slug) =>
      this.portfolio.getCategories().pipe(
        map((list) => {
          const found = list.find((c) => c.slug === slug);
          if (found) return found;
          const fallback = DEFAULT_PORTFOLIO_CATEGORIES.find((c) => c.slug === slug);
          if (!fallback) return undefined;
          return {
            ...fallback,
            createdAt: '',
          } as PortfolioCategory;
        })
      )
    )
  );

  readonly photos$ = this.category$.pipe(
    switchMap((category) =>
      category?.id
        ? this.portfolio.getPhotosByCategory(category.id)
        : of([] as PortfolioPhoto[])
    )
  );

  openPreview(photo: PortfolioPhoto) {
    this.preview.set(photo);
  }

  closePreview() {
    this.preview.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.preview()) this.closePreview();
  }
}
