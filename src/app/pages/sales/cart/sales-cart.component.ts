import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';
import { SaleService } from '../../../core/services/sale.service';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import { FirebaseError } from 'firebase/app';

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
      const result = await this.sales.createPixOrder({
        eventId,
        photoIds,
        items,
        buyer: {
          name: v.name.trim(),
          email: v.email.trim(),
          phone: v.phone.trim(),
          cpf: v.cpf.replace(/\D/g, ''),
        },
      });

      this.cart.clear();
      await this.router.navigate(['/fotos/pedido', result.orderId], {
        queryParams: { token: result.accessToken },
      });
    } catch (err) {
      console.error('[checkout]', err);
      if (err instanceof FirebaseError && err.code === 'permission-denied') {
        this.error.set(
          'Sem permiss\u00e3o para criar pedido. Publique as rules da cole\u00e7\u00e3o orders no Firebase.'
        );
      } else {
        this.error.set('N\u00e3o foi poss\u00edvel gerar o Pix. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
