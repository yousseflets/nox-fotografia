import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { SaleService } from '../../../core/services/sale.service';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

@Component({
  selector: 'app-sales-order-status',
  standalone: true,
  imports: [AsyncPipe, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './sales-order-status.component.html',
  styleUrl: './sales-order-status.component.scss',
})
export class SalesOrderStatusComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sales = inject(SaleService);

  readonly formatPrice = formatPriceBRL;
  readonly loadingDownloads = signal(false);
  readonly downloads = signal<{ filename: string; url: string }[]>([]);
  readonly error = signal('');

  readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
  readonly accessToken = this.route.snapshot.queryParamMap.get('token') ?? '';

  readonly order$ = this.sales.getOrder(this.orderId);
  readonly order = toSignal(this.order$, { initialValue: undefined });

  async loadDownloads() {
    const order = this.order();
    if (!order?.id || order.status !== 'paid') return;
    const token = this.accessToken || order.accessToken || '';
    if (!token) {
      this.error.set('Token de acesso ausente. Use o link do e-mail.');
      return;
    }
    this.loadingDownloads.set(true);
    this.error.set('');
    try {
      const files = await this.sales.getDownloads(order.id, token);
      this.downloads.set(files);
    } catch {
      this.error.set('N\u00e3o foi poss\u00edvel liberar o download.');
    } finally {
      this.loadingDownloads.set(false);
    }
  }
}
