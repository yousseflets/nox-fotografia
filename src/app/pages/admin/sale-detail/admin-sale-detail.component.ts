import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SaleService } from '../../../core/services/sale.service';
import { SalePhoto } from '../../../core/models/sale-photo.model';
import { formatPriceBRL } from '../../../core/models/sale-event.model';

import { CurrencyBrlInputDirective } from '../../../shared/directives/currency-brl-input.directive';

@Component({
  selector: 'app-admin-sale-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink, ReactiveFormsModule, CurrencyBrlInputDirective],
  templateUrl: './admin-sale-detail.component.html',
  styleUrl: './admin-sale-detail.component.scss',
})
export class AdminSaleDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sales = inject(SaleService);
  private readonly fb = inject(FormBuilder);

  readonly eventId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly event$ = this.sales.getEventById(this.eventId);
  readonly photos$ = this.sales.getPhotos(this.eventId);
  readonly event = toSignal(this.event$, { initialValue: undefined });

  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly message = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly formatPrice = formatPriceBRL;
  readonly preview = this.sales.previewUrl;

  readonly metaForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    eventDate: ['', Validators.required],
    priceReais: [15, [Validators.required, Validators.min(1)]],
    description: [''],
    active: [true],
  });

  constructor() {
    this.event$.subscribe((ev) => {
      if (!ev) return;
      this.metaForm.patchValue({
        title: ev.title,
        eventDate: ev.eventDate,
        priceReais: ev.priceCents / 100,
        description: ev.description || '',
        active: ev.active,
      });
    });
  }

  async saveMeta() {
    if (this.metaForm.invalid || !this.eventId) return;
    this.saving.set(true);
    this.error.set('');
    try {
      const v = this.metaForm.getRawValue();
      await this.sales.updateEvent(this.eventId, {
        title: v.title.trim(),
        eventDate: v.eventDate,
        description: v.description.trim(),
        priceCents: Math.round(Number(v.priceReais) * 100),
        active: v.active,
      });
      this.message.set('Dados salvos.');
    } catch {
      this.error.set('N\u00e3o foi poss\u00edvel salvar.');
    } finally {
      this.saving.set(false);
    }
  }

  async onFilesSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length || !this.eventId) return;

    this.uploading.set(true);
    this.error.set('');
    this.message.set('');
    let done = 0;
    try {
      let hasCover = !!this.event()?.coverUrl;
      for (const file of files) {
        const photo = await this.sales.uploadPhoto(file, this.eventId, (pct) => {
          const overall = ((done + pct / 100) / files.length) * 100;
          this.progress.set(Math.round(overall));
        });
        if (!hasCover && photo.previewUrl) {
          await this.sales.ensureCover(this.eventId, photo.previewUrl);
          hasCover = true;
        }
        done += 1;
      }
      this.message.set(`${files.length} foto(s) enviada(s) com marca d'\u00e1gua.`);
    } catch {
      this.error.set('Falha no upload.');
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
    }
  }

  async remove(photo: SalePhoto) {
    if (!confirm('Remover esta foto?')) return;
    try {
      await this.sales.deletePhoto(photo);
    } catch {
      this.error.set('N\u00e3o foi poss\u00edvel remover.');
    }
  }

  async deleteEvent() {
    const title = this.event()?.title || 'evento';
    if (!confirm(`Excluir "${title}" e todas as fotos?`)) return;
    try {
      await this.sales.deleteEvent(this.eventId);
      await this.router.navigateByUrl('/admin/vendas');
    } catch {
      this.error.set('N\u00e3o foi poss\u00edvel excluir.');
    }
  }
}
