import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { SaleService } from '../../../core/services/sale.service';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { SalePaymentMethod } from '../../../core/models/sale-order.model';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

@Component({
  selector: 'app-sales-cart',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './sales-cart.component.html',
  styleUrl: './sales-cart.component.scss',
})
export class SalesCartComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sales = inject(SaleService);
  private readonly router = inject(Router);
  readonly cart = inject(CartService);

  readonly formatPrice = formatPriceBRL;
  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    cpf: ['', [Validators.required, Validators.minLength(11)]],
    paymentMethod: ['pix' as SalePaymentMethod, Validators.required],
  });

  remove(photoId: string) {
    this.cart.remove(photoId);
  }

  async checkout() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Preencha todos os dados para continuar.');
      return;
    }
    const items = this.cart.items();
    if (!items.length) {
      this.error.set('Seu carrinho est\u00e1 vazio.');
      return;
    }

    // Um pedido por evento (primeiro evento do carrinho; se misturar, filtra)
    const eventId = items[0].eventId;
    const photoIds = items.filter((i) => i.eventId === eventId).map((i) => i.photoId);
    if (photoIds.length !== items.length) {
      this.error.set('Finalize um evento por vez. Remova fotos de outros eventos.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      const result = await this.sales.createCheckout({
        eventId,
        photoIds,
        buyer: {
          name: v.name.trim(),
          email: v.email.trim(),
          phone: v.phone.trim(),
          cpf: v.cpf.replace(/\D/g, ''),
        },
        paymentMethod: v.paymentMethod,
      });

      this.cart.clear();
      const url = result.initPoint || result.sandboxInitPoint;
      if (url) {
        window.location.href = url;
        return;
      }
      await this.router.navigate(['/fotos/pedido', result.orderId], {
        queryParams: result.accessToken ? { token: result.accessToken } : undefined,
      });
    } catch (err) {
      console.error('[checkout]', err);
      const code = String((err as { code?: string })?.code || '');
      if (code.includes('not-found') || code.includes('unimplemented')) {
        this.error.set(
          'Pagamento ainda n\u00e3o dispon\u00edvel: as Cloud Functions do Mercado Pago n\u00e3o foram publicadas.'
        );
      } else if (code.includes('failed-precondition')) {
        this.error.set(
          'Mercado Pago sem Access Token. Configure o secret MP_ACCESS_TOKEN nas Functions.'
        );
      } else {
        this.error.set(
          'N\u00e3o foi poss\u00edvel iniciar o pagamento. Confira se o Mercado Pago est\u00e1 configurado.'
        );
      }
    } finally {
      this.loading.set(false);
    }
  }
}
