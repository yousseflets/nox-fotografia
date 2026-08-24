import { Component, computed, inject, signal } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { SaleService } from '../../../core/services/sale.service';
import { CartService } from '../../../core/services/cart.service';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { SalePhoto } from '../../../core/models/sale-photo.model';

@Component({
  selector: 'app-sales-event-gallery',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './sales-event-gallery.component.html',
  styleUrl: './sales-event-gallery.component.scss',
})
export class SalesEventGalleryComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sales = inject(SaleService);
  readonly cart = inject(CartService);

  readonly formatPrice = formatPriceBRL;
  readonly preview = this.sales.previewUrl;
  readonly selected = signal<Record<string, boolean>>({});

  readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';
  readonly event$ = this.sales.getEventBySlug(this.slug);
  readonly event = toSignal(this.event$, { initialValue: undefined });

  readonly photos$ = this.event$.pipe(
    switchMap((ev) => (ev?.id ? this.sales.getPhotos(ev.id) : of([] as SalePhoto[])))
  );
  readonly photos = toSignal(this.photos$, { initialValue: [] as SalePhoto[] });

  readonly selectedCount = computed(
    () => Object.values(this.selected()).filter(Boolean).length
  );
  readonly selectedTotal = computed(() => {
    const price = this.event()?.priceCents ?? 0;
    return this.selectedCount() * price;
  });

  toggle(photo: SalePhoto) {
    if (!photo.id) return;
    this.selected.update((map) => ({ ...map, [photo.id!]: !map[photo.id!] }));
  }

  isSelected(photo: SalePhoto) {
    return !!photo.id && !!this.selected()[photo.id];
  }

  addSelectedToCart() {
    const event = this.event();
    if (!event?.id) return;
    const items = this.photos()
      .filter((p) => p.id && this.selected()[p.id])
      .map((p) => ({
        photoId: p.id!,
        eventId: event.id!,
        filename: p.filename,
        previewUrl: this.preview(p),
        priceCents: event.priceCents,
      }));
    this.cart.addMany(items);
    void this.router.navigateByUrl('/carrinho');
  }

  buyOne(photo: SalePhoto) {
    const event = this.event();
    if (!event?.id || !photo.id) return;
    this.cart.add({
      photoId: photo.id,
      eventId: event.id,
      filename: photo.filename,
      previewUrl: this.preview(photo),
      priceCents: event.priceCents,
    });
    void this.router.navigateByUrl('/carrinho');
  }
}
