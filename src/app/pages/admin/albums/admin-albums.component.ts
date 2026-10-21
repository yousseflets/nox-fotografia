import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AlbumService, UserService } from '../../../core/services/album.service';
import { MailService } from '../../../core/services/mail.service';
import { SaleService } from '../../../core/services/sale.service';
import { Album, isSaleAlbum } from '../../../core/models/album.model';
import { formatPriceBRL } from '../../../core/models/sale-event.model';
import { AppUser } from '../../../core/models/user.model';
import { CurrencyBrlInputDirective } from '../../../shared/directives/currency-brl-input.directive';

@Component({
  selector: 'app-admin-albums',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe, RouterLink, CurrencyBrlInputDirective],
  templateUrl: './admin-albums.component.html',
  styleUrl: './admin-albums.component.scss',
})
export class AdminAlbumsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly albums = inject(AlbumService);
  private readonly users = inject(UserService);
  private readonly mail = inject(MailService);
  private readonly sales = inject(SaleService);

  readonly albums$ = this.albums.getAll();
  readonly clients$ = this.users.getClients();
  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly formatPrice = formatPriceBRL;
  readonly isSale = isSaleAlbum;

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    clientId: ['', Validators.required],
    description: [''],
    notifyClient: [true],
    mode: ['delivery' as 'delivery' | 'sale'],
    priceReais: [15],
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
      const value = this.form.getRawValue();
      const clients = await firstValueFrom(this.clients$);
      const client = clients.find((c: AppUser) => c.uid === value.clientId);
      const mode = value.mode;
      let priceCents: number | undefined;
      let saleEventId: string | undefined;

      if (mode === 'sale') {
        const price = Number(value.priceReais);
        if (!Number.isFinite(price) || price < 1) {
          this.error.set('Informe um preço de pelo menos R$ 1,00 por foto.');
          return;
        }
        priceCents = Math.round(price * 100);
        saleEventId = await this.sales.createEvent({
          title: value.title.trim(),
          eventDate: new Date().toISOString().slice(0, 10),
          description: value.description.trim(),
          priceCents,
          active: true,
          audience: 'client',
        });
      }

      const album: Omit<Album, 'id'> = {
        title: value.title,
        clientId: value.clientId,
        clientName: client?.name ?? '',
        description: value.description,
        createdAt: new Date().toISOString(),
        mode,
      };
      if (priceCents != null) album.priceCents = priceCents;
      if (saleEventId) album.saleEventId = saleEventId;

      try {
        await this.albums.create(album);
      } catch (err) {
        if (saleEventId) {
          try {
            await this.sales.deleteEvent(saleEventId);
          } catch {
            // o álbum não chegou a ser criado
          }
        }
        throw err;
      }

      let mailNote = '';
      if (value.notifyClient) {
        if (!client?.email) {
          mailNote = ' Ã�lbum criado, mas o cliente nÃ£o tem e-mail cadastrado.';
        } else {
          try {
            await this.mail.notifyAlbumAvailable({
              to: client.email,
              clientName: client.name || '',
              albumTitle: value.title,
            });
            mailNote = ' E-mail de aviso enviado ao cliente.';
          } catch (err) {
            console.error('[admin-albums.notify]', err);
            const detail =
              err instanceof Error && err.message
                ? err.message
                : 'Confira a extensÃ£o Trigger Email e as rules da coleÃ§Ã£o mail.';
            mailNote = ` Ã�lbum criado, mas o e-mail nÃ£o pÃ´de ser enfileirado. ${detail}`;
          }
        }
      }

      this.message.set('Ã�lbum criado. Abra-o para enviar as fotos.' + mailNote);
      this.form.reset({
        title: '',
        clientId: '',
        description: '',
        notifyClient: true,
        mode: 'delivery',
        priceReais: 15,
      });
    } catch {
      this.error.set('NÃ£o foi possÃ­vel criar o Ã¡lbum.');
    } finally {
      this.loading.set(false);
    }
  }

  async remove(album: Album, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    if (!album.id) return;

    const ok = confirm(
      `Excluir o Ã¡lbum "${album.title}"?\nTodas as fotos deste Ã¡lbum tambÃ©m serÃ£o removidas.`
    );
    if (!ok) return;

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      await this.albums.deleteAlbum(album.id);
      this.message.set('Ã�lbum excluÃ­do.');
    } catch {
      this.error.set('NÃ£o foi possÃ­vel excluir o Ã¡lbum.');
    } finally {
      this.loading.set(false);
    }
  }
}
