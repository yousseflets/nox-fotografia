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
import { saveAs } from 'file-saver';

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
  readonly syncingPayment = signal(false);
  readonly downloads = signal<{ filename: string; url: string }[]>([]);
  readonly downloadingFilename = signal<string | null>(null);
  readonly error = signal('');
  readonly copied = signal(false);

  readonly orderId = this.route.snapshot.paramMap.get('orderId') ?? '';
  readonly accessToken = this.route.snapshot.queryParamMap.get('token') ?? '';
  readonly ipSlug = this.route.snapshot.queryParamMap.get('slug') ?? '';
  readonly ipTransactionNsu = this.route.snapshot.queryParamMap.get('transaction_nsu') ?? '';
  readonly pixKey = environment.pix.key;

  readonly order$ = this.sales.getOrder(this.orderId);
  readonly order = toSignal(this.order$, { initialValue: undefined });

  readonly canAccess = computed(() => {
    const order = this.order();
    const token = this.accessToken || '';
    return !!order?.accessToken && token === order.accessToken;
  });

  readonly isManualPix = computed(() => {
    const order = this.order();
    return order?.status === 'pending' && order?.paymentProvider !== 'infinitepay';
  });

  readonly isInfinitePayPending = computed(() => {
    const order = this.order();
    return order?.status === 'pending' && order?.paymentProvider === 'infinitepay';
  });

  readonly pixPayload = computed(() => {
    const order = this.order();
    if (!order?.id || !this.isManualPix()) return '';
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

    effect(() => {
      const order = this.order();
      if (order?.status === 'paid' && this.canAccess() && !order.downloadFiles?.length) {
        void this.loadDownloads();
      }
    });

    void this.syncPaymentIfNeeded();
  }

  async syncPaymentIfNeeded() {
    if (!this.orderId || !this.accessToken) return;

    this.syncingPayment.set(true);
    this.error.set('');
    try {
      const result = await this.sales.syncInfinitePayPayment({
        orderId: this.orderId,
        accessToken: this.accessToken,
        slug: this.ipSlug || undefined,
        transactionNsu: this.ipTransactionNsu || undefined,
      });
      if (!result.paid && this.isInfinitePayPending()) {
        // aguardando webhook ou retorno com slug/transaction_nsu na URL
      }
    } catch (err) {
      console.error('[order.sync]', err);
      if (err instanceof FirebaseError && err.code === 'functions/not-found') {
        this.error.set('Confirma\u00e7\u00e3o autom\u00e1tica indispon\u00edvel. Aguarde ou atualize a p\u00e1gina.');
      }
    } finally {
      this.syncingPayment.set(false);
    }
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

    if (this.loadingDownloads()) return;

    this.loadingDownloads.set(true);
    this.error.set('');
    try {
      const files = await this.sales.getDownloads(order.id, this.accessToken);
      this.downloads.set(files);
      if (!files.length) {
        this.error.set('Nenhum arquivo dispon\u00edvel. Tente novamente em instantes.');
      }
    } catch (err) {
      console.error('[order.downloads]', err);
      this.error.set(this.downloadErrorMessage(err));
    } finally {
      this.loadingDownloads.set(false);
    }
  }

  async downloadFile(file: { filename: string; url: string }) {
    if (this.downloadingFilename()) return;

    this.downloadingFilename.set(file.filename);
    this.error.set('');
    try {
      const res = await fetch(file.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      saveAs(blob, file.filename);
    } catch (err) {
      console.error('[order.downloadFile]', err);
      this.error.set('N\u00e3o foi poss\u00edvel baixar esta foto. Tente novamente.');
    } finally {
      this.downloadingFilename.set(null);
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
      if (err.code === 'functions/failed-precondition') {
        return 'Pagamento ainda n\u00e3o confirmado. Aguarde alguns segundos e atualize a p\u00e1gina.';
      }
      if (err.code === 'functions/not-found' || err.code === 'functions/unavailable') {
        return 'Downloads temporariamente indispon\u00edveis. Atualize a p\u00e1gina em instantes.';
      }
      if (err.code === 'functions/permission-denied') {
        return 'Token de acesso inv\u00e1lido. Use o link completo do pedido.';
      }
      if (err.message) return err.message;
    }
    return 'N\u00e3o foi poss\u00edvel liberar o download. Atualize a p\u00e1gina em instantes.';
  }
}
