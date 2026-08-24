import { Component, computed, effect, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FirebaseError } from 'firebase/app';
import { SaleService } from '../../../core/services/sale.service';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { buildPixPayload } from '../../../core/utils/pix-payload';
import { environment } from '../../../../environments/environment';

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
  readonly copied = signal(false);

  readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
  readonly accessToken = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly pixKey = environment.pix.key;

  readonly order$ = this.sales.getOrder(this.orderId);
  readonly order = toSignal(this.order$, { initialValue: undefined });

  readonly canAccess = computed(() => {
    const order = this.order();
    const token = this.accessToken || '';
    return !!order?.accessToken && token === order.accessToken;
  });

  readonly pixPayload = computed(() => {
    const order = this.order();
    if (!order?.id || order.status !== 'pending') return '';
    return buildPixPayload({
      pixKey: environment.pix.key,
      merchantName: environment.pix.merchantName,
      merchantCity: environment.pix.merchantCity,
      amountReais: order.totalCents / 100,
      txid: order.id,
    });
  });

  readonly qrImageUrl = computed(() => {
    const payload = this.pixPayload();
    if (!payload) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(payload)}`;
  });

  constructor() {
    effect(() => {
      this.pixPayload();
      this.copied.set(false);
    });

    effect(() => {
      const order = this.order();
      if (order?.status === 'paid' && this.canAccess() && order.downloadFiles?.length) {
        this.downloads.set(order.downloadFiles);
        this.error.set('');
      }
    });
  }

  async loadDownloads() {
    const order = this.order();
    if (!order?.id || order.status !== 'paid') return;
    if (!this.canAccess()) {
      this.error.set('Token de acesso inv\u00e1lido. Use o link completo do pedido.');
      return;
    }

    if (order.downloadFiles?.length) {
      this.downloads.set(order.downloadFiles);
      return;
    }

    this.loadingDownloads.set(true);
    this.error.set('');
    try {
      const files = await this.sales.getDownloads(order.id, this.accessToken);
      this.downloads.set(files);
      if (!files.length) {
        this.error.set('Nenhum arquivo dispon\u00edvel. Aguarde a confirma\u00e7\u00e3o da NOX.');
      }
    } catch (err) {
      console.error('[order.downloads]', err);
      this.error.set(this.downloadErrorMessage(err));
    } finally {
      this.loadingDownloads.set(false);
    }
  }

  async copyPix() {
    const payload = this.pixPayload();
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      this.copied.set(true);
    } catch {
      this.error.set('N\u00e3o foi poss\u00edvel copiar o c\u00f3digo Pix.');
    }
  }

  private downloadErrorMessage(err: unknown): string {
    if (err instanceof FirebaseError) {
      if (err.code === 'functions/not-found' || err.code === 'functions/unavailable') {
        return 'Downloads ainda n\u00e3o liberados. Aguarde a confirma\u00e7\u00e3o da NOX ou atualize a p\u00e1gina.';
      }
      if (err.code === 'functions/permission-denied') {
        return 'Token de acesso inv\u00e1lido. Use o link completo do pedido.';
      }
    }
    return 'N\u00e3o foi poss\u00edvel liberar o download. Atualize a p\u00e1gina em instantes.';
  }
}
