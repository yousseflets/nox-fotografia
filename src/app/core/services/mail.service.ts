import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';
import { environment } from '../../../environments/environment';

export type AlbumAvailableMailInput = {
  to: string;
  clientName: string;
  albumTitle: string;
};

@Injectable({ providedIn: 'root' })
export class MailService {
  private readonly firestore = inject(Firestore);

  /** Enfileira e-mail na cole\u00e7\u00e3o `mail` (extens\u00e3o Trigger Email from Firestore). */
  async notifyAlbumAvailable(input: AlbumAvailableMailInput): Promise<void> {
    const to = input.to.trim();
    if (!to) {
      throw new Error('Cliente sem e-mail cadastrado.');
    }

    const name = input.clientName.trim() || 'ol\u00e1';
    const title = input.albumTitle.trim() || 'seu ensaio';
    const loginUrl = `${environment.siteUrl.replace(/\/$/, '')}/login`;
    const areaUrl = `${environment.siteUrl.replace(/\/$/, '')}/cliente`;

    const subject = `NOX Fotografia - \u00e1lbum dispon\u00edvel: ${title}`;
    const text = [
      `Oi, ${name}!`,
      '',
      `Seu \u00e1lbum "${title}" j\u00e1 est\u00e1 dispon\u00edvel na sua \u00e1rea do cliente.`,
      '',
      `Acesse: ${areaUrl}`,
      `Login: ${loginUrl}`,
      '',
      'NOX Fotografia',
    ].join('\n');

    const html = [
      '<div style="font-family:Georgia,serif;color:#222;line-height:1.6;max-width:560px;">',
      `<p>Oi, <strong>${escapeHtml(name)}</strong>!</p>`,
      `<p>Seu \u00e1lbum <strong>${escapeHtml(title)}</strong> j\u00e1 est\u00e1 dispon\u00edvel na sua \u00e1rea do cliente.</p>`,
      '<p style="margin:1.5rem 0;">',
      `<a href="${escapeHtml(areaUrl)}" style="display:inline-block;padding:12px 20px;background:#d4af37;color:#000;text-decoration:none;letter-spacing:0.08em;font-family:Arial,sans-serif;font-size:12px;text-transform:uppercase;">Ver meu \u00e1lbum</a>`,
      '</p>',
      `<p style="font-size:14px;color:#555;">Login: <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>`,
      '<p style="margin-top:2rem;">NOX Fotografia</p>',
      '</div>',
    ].join('');

    try {
      await addDoc(collection(this.firestore, 'mail'), {
        to: [to],
        message: {
          subject,
          text,
          html,
        },
      });
    } catch (err) {
      console.error('[MailService.notifyAlbumAvailable]', err);
      if (err instanceof FirebaseError) {
        if (err.code === 'permission-denied') {
          throw new Error(
            'Sem permiss\u00e3o para criar em /mail. Publique o firestore.rules no Firebase (cole\u00e7\u00e3o mail).'
          );
        }
        throw new Error(`Falha ao enfileirar e-mail (${err.code}).`);
      }
      throw err;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
