import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { SaleService } from '../../../core/services/sale.service';
import { SaleEvent, formatPriceBRL } from '../../../core/models/sale-event.model';

import { CurrencyBrlInputDirective } from '../../../shared/directives/currency-brl-input.directive';

@Component({
  selector: 'app-admin-sales',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe, RouterLink, CurrencyBrlInputDirective],
  templateUrl: './admin-sales.component.html',
  styleUrl: './admin-sales.component.scss',
})
export class AdminSalesComponent {
  private readonly fb = inject(FormBuilder);
  private readonly sales = inject(SaleService);
  private readonly router = inject(Router);

  private readonly listTick = signal(0);
  readonly events$ = toObservable(this.listTick).pipe(
    switchMap(() => this.sales.getEvents(false))
  );
  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly formatPrice = formatPriceBRL;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    eventDate: ['', Validators.required],
    description: [''],
    priceReais: [15, [Validators.required, Validators.min(1)]],
    active: [true],
  });

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.message.set('');
    try {
      const v = this.form.getRawValue();
      const price = Number(v.priceReais);
      if (!Number.isFinite(price) || price < 1) {
        this.error.set('Informe um pre\u00e7o v\u00e1lido (m\u00ednimo R$ 1,00).');
        return;
      }
      const id = await this.sales.createEvent({
        title: v.title.trim(),
        eventDate: v.eventDate,
        description: v.description.trim(),
        priceCents: Math.round(price * 100),
        active: v.active,
      });
      this.message.set('Evento criado. Abrindo para enviar as fotos...');
      this.form.reset({ title: '', eventDate: '', description: '', priceReais: 15, active: true });
      this.listTick.update((n) => n + 1);
      await this.router.navigate(['/admin/vendas', id]);
    } catch (err) {
      console.error('[AdminSales.create]', err);
      const code = (err as { code?: string })?.code || '';
      if (code === 'permission-denied') {
        this.error.set(
          'Sem permiss\u00e3o no Firestore. Publique as rules (cole\u00e7\u00e3o saleEvents) no Firebase Console.'
        );
      } else {
        this.error.set('N\u00e3o foi poss\u00edvel criar o evento.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async remove(event: SaleEvent, ev: Event) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!event.id) return;
    const ok = confirm(`Excluir o evento "${event.title}" e todas as fotos?`);
    if (!ok) return;
    this.loading.set(true);
    try {
      await this.sales.deleteEvent(event.id);
      this.message.set('Evento exclu\u00eddo.');
      this.listTick.update((n) => n + 1);
    } catch {
      this.error.set('N\u00e3o foi poss\u00edvel excluir.');
    } finally {
      this.loading.set(false);
    }
  }
}
