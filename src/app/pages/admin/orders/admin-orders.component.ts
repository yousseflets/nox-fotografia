import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { FirebaseError } from 'firebase/app';
import { SaleService } from '../../../core/services/sale.service';
import { MailService } from '../../../core/services/mail.service';
import {
  SaleOrder,
  SaleOrderStatus,
  SALE_ORDER_STATUS_LABELS,
} from '../../../core/models/sale-order.model';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { environment } from '../../../../environments/environment';

type StatusFilter = 'all' | SaleOrderStatus;

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [],
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin-orders.component.scss',
})
export class AdminOrdersComponent {
  private readonly sales = inject(SaleService);
  private readonly mail = inject(MailService);

  private readonly listTick = signal(0);
  readonly listError = signal('');
  readonly list = toSignal(
    toObservable(this.listTick).pipe(
      switchMap(() =>
        this.sales.getOrders().pipe(
          tap(() => this.listError.set('')),
          catchError((err) => {
            console.error('[admin.orders.list]', err);
            this.listError.set(this.errorMessage(err));
            return of([] as SaleOrder[]);
          })
        )
      )
    ),
    { initialValue: [] as SaleOrder[] }
  );

  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly statusFilter = signal<StatusFilter>('pending');
  readonly copiedId = signal('');

  readonly formatPrice = formatPriceBRL;
  readonly statusLabels = SALE_ORDER_STATUS_LABELS;

  readonly filters: { id: StatusFilter; label: string }[] = [
    { id: 'pending', label: 'Aguardando Pix' },
    { id: 'paid', label: 'Pagos' },
    { id: 'all', label: 'Todos' },
    { id: 'cancelled', label: 'Cancelados' },
    { id: 'failed', label: 'Falhou' },
  ];

  readonly filtered = computed(() => {
    const filter = this.statusFilter();
    const items = this.list();
    if (filter === 'all') return items;
    return items.filter((item) => item.status === filter);
  });

  readonly pendingCount = computed(
    () => this.list().filter((item) => item.status === 'pending').length
  );

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
  }

  reloadList() {
    this.listTick.update((n) => n + 1);
  }

  formatWhen(order: SaleOrder): string {
    const raw = order.paidAt || order.createdAt;
    if (!raw) return '';
    return new Date(raw).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  orderLink(order: SaleOrder): string {
    const base = environment.siteUrl.replace(/\/$/, '');
    const token = order.accessToken || '';
    return `${base}/fotos/pedido/${order.id}?token=${token}`;
  }

  async confirmPayment(order: SaleOrder) {
    if (!order.id || order.status !== 'pending') return;
    if (!confirm(`Confirmar pagamento de ${order.buyer.name} (${this.formatPrice(order.totalCents)})?`)) {
      return;
    }

    this.loading.set(true);
    this.message.set('');
    this.error.set('');
    try {
      await this.sales.updateOrderStatus(order.id, 'paid');
      try {
        await this.sales.prepareOrderDownloads(order.id);
      } catch (dlErr) {
        console.error('[admin.orders.downloads]', dlErr);
        this.error.set(
          this.errorMessage(dlErr, 'liberar downloads') +
            ' O pagamento foi confirmado; clique em "Gerar links" para tentar de novo.'
        );
      }

      if (order.buyer.email && order.accessToken) {
        try {
          await this.mail.notifyOrderPaid({
            to: order.buyer.email,
            name: order.buyer.name,
            eventTitle: order.eventTitle,
            orderId: order.id,
            accessToken: order.accessToken,
            totalCents: order.totalCents,
          });
          this.message.set('Pagamento confirmado e e-mail enviado ao cliente.');
        } catch (mailErr) {
          console.warn('[admin.orders.mail]', mailErr);
          this.message.set(
            'Pagamento confirmado. N\u00e3o foi poss\u00edvel enviar o e-mail \u2014 copie o link do pedido.'
          );
        }
      } else if (!this.error()) {
        this.message.set('Pagamento confirmado e downloads liberados.');
      }
    } catch (err) {
      console.error('[admin.orders.confirm]', err);
      this.error.set(this.errorMessage(err, 'confirmar pagamento'));
    } finally {
      this.loading.set(false);
    }
  }

  async cancelOrder(order: SaleOrder) {
    if (!order.id || order.status !== 'pending') return;
    if (!confirm(`Cancelar pedido de ${order.buyer.name}?`)) return;

    this.loading.set(true);
    this.message.set('');
    this.error.set('');
    try {
      await this.sales.updateOrderStatus(order.id, 'cancelled');
      this.message.set('Pedido cancelado.');
    } catch (err) {
      console.error('[admin.orders.cancel]', err);
      this.error.set(this.errorMessage(err, 'cancelar pedido'));
    } finally {
      this.loading.set(false);
    }
  }

  async regenerateDownloads(order: SaleOrder) {
    if (!order.id || order.status !== 'paid') return;

    this.loading.set(true);
    this.message.set('');
    this.error.set('');
    try {
      await this.sales.prepareOrderDownloads(order.id);
      this.message.set('Links de download gerados.');
    } catch (err) {
      console.error('[admin.orders.regenerate]', err);
      this.error.set(this.errorMessage(err, 'gerar links de download'));
    } finally {
      this.loading.set(false);
    }
  }

  async copyLink(order: SaleOrder) {
    if (!order.id) return;
    try {
      await navigator.clipboard.writeText(this.orderLink(order));
      this.copiedId.set(order.id);
      setTimeout(() => {
        if (this.copiedId() === order.id) this.copiedId.set('');
      }, 2000);
    } catch {
      this.error.set('N\u00e3o foi poss\u00edvel copiar o link.');
    }
  }

  private errorMessage(err: unknown, action = 'carregar pedidos'): string {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      return `Sem permiss\u00e3o para ${action}. Publique as rules da cole\u00e7\u00e3o orders no Firebase.`;
    }
    if (err instanceof Error && err.message) return err.message;
    return `N\u00e3o foi poss\u00edvel ${action}.`;
  }
}
