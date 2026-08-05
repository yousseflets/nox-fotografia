import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { PortfolioService } from '../../core/services/portfolio.service';
import {
  DEFAULT_PORTFOLIO_CATEGORIES,
  PortfolioCategory,
  PortfolioPhoto,
} from '../../core/models/portfolio.model';
import {
  PORTFOLIO_PHOTOS_PAGE_SIZE,
  paginateItems,
  totalPages,
} from '../../core/utils/album-pagination';

type CategoryView = {
  loading: boolean;
  category?: PortfolioCategory;
  photos: PortfolioPhoto[];
};

@Component({
  selector: 'app-portfolio-category',
  standalone: true,
  imports: [RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './portfolio-category.component.html',
  styleUrl: './portfolio-category.component.scss',
})
export class PortfolioCategoryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly portfolio = inject(PortfolioService);

  readonly pageSize = PORTFOLIO_PHOTOS_PAGE_SIZE;
  readonly page = signal(1);
  readonly preview = signal<PortfolioPhoto | null>(null);
  readonly loadedIds = signal<Record<string, boolean>>({});

  readonly view = toSignal(
    this.route.paramMap.pipe(
      map((p) => p.get('slug') || ''),
      tap(() => {
        this.page.set(1);
        this.loadedIds.set({});
      }),
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
    ),
    {
      initialValue: { loading: true, category: undefined, photos: [] } as CategoryView,
    }
  );

  readonly pageCount = computed(() => totalPages(this.view().photos.length, this.pageSize));
  readonly pagedPhotos = computed(() =>
    paginateItems(this.view().photos, this.page(), this.pageSize)
  );
  readonly showPager = computed(() => this.view().photos.length > 0);

  constructor() {
    effect(() => {
      const max = this.pageCount();
      if (max > 0 && this.page() > max) this.page.set(max);
    });
  }

  goToPage(page: number) {
    const max = this.pageCount();
    if (!max) return;
    this.page.set(Math.min(max, Math.max(1, page)));
    this.loadedIds.set({});
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

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
