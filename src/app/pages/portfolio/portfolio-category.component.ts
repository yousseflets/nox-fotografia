import { AsyncPipe } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PortfolioService } from '../../core/services/portfolio.service';
import {
  DEFAULT_PORTFOLIO_CATEGORIES,
  PortfolioCategory,
  PortfolioPhoto,
} from '../../core/models/portfolio.model';

type CategoryView = {
  loading: boolean;
  category?: PortfolioCategory;
  photos: PortfolioPhoto[];
};

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
  readonly loadedIds = signal<Record<string, boolean>>({});

  readonly view$ = this.route.paramMap.pipe(
    map((p) => p.get('slug') || ''),
    switchMap((slug) => {
      if (!slug) {
        return of<CategoryView>({ loading: false, category: undefined, photos: [] });
      }

      const category$ = this.portfolio.getCategoryBySlug(slug).pipe(
        map((found) => {
          if (found) return found;
          const fallback = DEFAULT_PORTFOLIO_CATEGORIES.find((c) => c.slug === slug);
          if (!fallback) return undefined;
          return {
            ...fallback,
            active: true,
            createdAt: '',
          } as PortfolioCategory;
        })
      );

      return combineLatest({
        category: category$,
        photosBySlug: this.portfolio.getPhotosBySlug(slug),
      }).pipe(
        switchMap(({ category, photosBySlug }) => {
          if (photosBySlug.length || !category?.id) {
            return of<CategoryView>({ loading: false, category, photos: photosBySlug });
          }
          return this.portfolio.getPhotosByCategoryOnce(category.id).pipe(
            map((photos) => ({ loading: false, category, photos }))
          );
        }),
        startWith<CategoryView>({ loading: true, category: undefined, photos: [] })
      );
    })
  );

  markLoaded(id: string | undefined) {
    if (!id) return;
    this.loadedIds.update((map) => ({ ...map, [id]: true }));
  }

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
