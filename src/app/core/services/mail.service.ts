import { Injectable, inject } from '@angular/core';
import { Firestore, addDoc, collection } from '@angular/fire/firestore';
import { FirebaseError } from 'firebase/app';
import { MAIL_ICON_PNG_BASE64 } from './mail-icons';
import { MAIL_LOGO_PNG_BASE64 } from './mail-logo';
import { formatPriceBRL } from '../models/sale-event.model';
import { environment } from '../../../environments/environment';

export type AlbumAvailableMailInput = {
  to: string;
  clientName: string;
  albumTitle: string;
};

export type OrderPaidMailInput = {
  to: string;
  name: string;
  eventTitle: string;
  orderId: string;
  accessToken: string;
  totalCents: number;
};

const SITE_BASE = environment.siteUrl.replace(/\/$/, '');
const LOGO_CID = 'cid:nox-logo';
const LOGO_URL = LOGO_CID;
const WHATSAPP = '(11) 98927-3898';
const WHATSAPP_URL = 'https://wa.me/5511989273898';

@Injectable({ providedIn: 'root' })
export class MailService {
  private readonly firestore = inject(Firestore);

  /** Enfileira e-mail na cole\u00e7\u00e3o `mail` (extens\u00e3o Trigger Email from Firestore). */
  async notifyAlbumAvailable(input: AlbumAvailableMailInput): Promise<void> {
    const to = input.to.trim();
    if (!to) {
      throw new Error('Cliente sem e-mail cadastrado.');
    }

    const name = input.clientName.trim() || 'cliente';
    const areaUrl = `${SITE_BASE}/cliente`;
    const loginUrl = `${SITE_BASE}/login`;

    const subject = 'NOX Fotografia \u2014 Seu \u00e1lbum est\u00e1 pronto';
    const text = [
      `Ol\u00e1, ${name}!`,
      '',
      'Seu \u00e1lbum est\u00e1 pronto.',
      'As suas mem\u00f3rias j\u00e1 est\u00e3o dispon\u00edveis na sua galeria exclusiva da NOX Fotografia.',
      '',
      `Acesse: ${areaUrl}`,
      `Login: ${loginUrl}`,
      '',
      'Com carinho,',
      'NOX Fotografia',
      'Momentos passam. Mem\u00f3rias permanecem.',
      '',
      'E-mail autom\u00e1tico. N\u00e3o responda.',
      `D\u00favidas: WhatsApp ${WHATSAPP}`,
    ].join('\n');

    const html = buildAlbumReadyHtml({
      name: escapeHtml(name),
      areaUrl: escapeHtml(areaUrl),
      loginUrl: escapeHtml(loginUrl),
      logoUrl: LOGO_URL,
      siteUrl: escapeHtml(SITE_BASE),
      whatsapp: escapeHtml(WHATSAPP),
      whatsappUrl: escapeHtml(WHATSAPP_URL),
      iconCamera: 'cid:nox-camera',
      iconUser: 'cid:nox-user',
      iconLock: 'cid:nox-lock',
      iconHeart: 'cid:nox-heart',
      iconStar: 'cid:nox-star',
    });

    try {
      await addDoc(collection(this.firestore, 'mail'), {
        to: [to],
        message: {
          subject,
          text,
          html,
          attachments: [
            iconAttachment('nox-logo.png', 'nox-logo', MAIL_LOGO_PNG_BASE64),
            iconAttachment('camera.png', 'nox-camera', MAIL_ICON_PNG_BASE64.camera),
            iconAttachment('user.png', 'nox-user', MAIL_ICON_PNG_BASE64.user),
            iconAttachment('lock.png', 'nox-lock', MAIL_ICON_PNG_BASE64.lock),
            iconAttachment('heart.png', 'nox-heart', MAIL_ICON_PNG_BASE64.heart),
            iconAttachment('star.png', 'nox-star', MAIL_ICON_PNG_BASE64.star),
          ],
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

  /** E-mail de pagamento confirmado (fotos à venda). */
  async notifyOrderPaid(input: OrderPaidMailInput): Promise<void> {
    const to = input.to.trim();
    if (!to) return;

    const name = input.name.trim() || 'cliente';
    const total = formatPriceBRL(input.totalCents);
    const orderUrl = `${SITE_BASE}/fotos/pedido/${input.orderId}?token=${input.accessToken}`;
    const subject = `NOX Fotografia \u2014 Pagamento confirmado (${input.eventTitle})`;
    const text = [
      `Ol\u00e1, ${name}!`,
      '',
      'Seu pagamento foi confirmado.',
      `Evento: ${input.eventTitle}`,
      `Total: ${total}`,
      '',
      `Baixe suas fotos (sem marca d'agua): ${orderUrl}`,
      '',
      'NOX Fotografia',
      'Momentos passam. Mem\u00f3rias permanecem.',
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;background:#0a0a0a;color:#f5f0e6;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #d4af37;border-radius:12px;padding:28px;">
        <tr><td align="center" style="padding-bottom:16px;">
          <img src="${LOGO_URL}" alt="NOX Fotografia" width="120" style="display:block;" />
        </td></tr>
        <tr><td style="color:#d4af37;font-size:22px;padding-bottom:12px;">Pagamento confirmado</td></tr>
        <tr><td style="color:#f5f0e6;font-size:16px;line-height:1.5;padding-bottom:12px;">
          Ol\u00e1, ${escapeHtml(name)}! Suas fotos de <strong>${escapeHtml(input.eventTitle)}</strong>
          (${escapeHtml(total)}) est\u00e3o prontas para download sem marca d'agua.
        </td></tr>
        <tr><td align="center" style="padding:18px 0;">
          <a href="${escapeHtml(orderUrl)}"
             style="display:inline-block;background:#d4af37;color:#0a0a0a;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;">
            Baixar fotos
          </a>
        </td></tr>
        <tr><td style="color:#9a9284;font-size:12px;line-height:1.4;">
          E-mail autom\u00e1tico \u2014 n\u00e3o responda.<br/>
          <a href="${SITE_BASE}" style="color:#d4af37;">nox-fotografia.com.br</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await addDoc(collection(this.firestore, 'mail'), {
        to: [to],
        message: {
          subject,
          text,
          html,
          attachments: [iconAttachment('nox-logo.png', 'nox-logo', MAIL_LOGO_PNG_BASE64)],
        },
      });
    } catch (err) {
      console.error('[MailService.notifyOrderPaid]', err);
      if (err instanceof FirebaseError && err.code === 'permission-denied') {
        throw new Error(
          'Sem permiss\u00e3o para enviar e-mail. Publique as rules da cole\u00e7\u00e3o mail no Firebase.'
        );
      }
      throw err;
    }
  }
}

function buildAlbumReadyHtml(p: {
  name: string;
  areaUrl: string;
  loginUrl: string;
  logoUrl: string;
  siteUrl: string;
  whatsapp: string;
  whatsappUrl: string;
  iconCamera: string;
  iconUser: string;
  iconLock: string;
  iconHeart: string;
  iconStar: string;
}): string {
  const gold = '#d4af37';
  const ink = '#f5f5f5';
  const mute = '#c8c8c8';
  const dim = '#8a8a8a';
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const serif = "font-family:Georgia,'Times New Roman',serif;";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NOX Fotografia</title>
</head>
<body style="margin:0;padding:0;background:#000000;${font}-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#000000;">

        <tr>
          <td align="center" style="padding:8px 24px 28px;">
            <a href="${p.areaUrl}" style="text-decoration:none;">
              <img src="${p.logoUrl}" width="140" alt="NOX Fotografia" style="display:block;width:140px;max-width:48%;height:auto;border:0;" />
            </a>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 28px 8px;color:${ink};font-size:18px;line-height:1.4;${font}">
            Ol&aacute;, <strong style="color:${gold};">${p.name}</strong>!
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:10px 0 18px;">
            <img src="${p.iconStar}" width="16" height="16" alt="" style="display:block;border:0;margin:0 auto;" />
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 28px 16px;">
            <h1 style="margin:0;${serif}font-size:34px;line-height:1.2;font-weight:400;color:${gold};">
              Seu &aacute;lbum est&aacute; pronto.
            </h1>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 0 18px;">
            <img src="${p.iconStar}" width="16" height="16" alt="" style="display:block;border:0;margin:0 auto;" />
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 36px 28px;color:${ink};font-size:15px;line-height:1.65;${font}">
            As suas mem&oacute;rias j&aacute; est&atilde;o dispon&iacute;veis na sua galeria exclusiva da
            <strong style="color:${gold};">NOX Fotografia</strong>.
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 28px 22px;">
            <a href="${p.areaUrl}" style="display:inline-block;padding:14px 28px;background:${gold};color:#111111;text-decoration:none;${font}font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:6px;">
              <img src="${p.iconCamera}" width="18" height="18" alt="" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0;" />ACESSAR MEU &Aacute;LBUM
            </a>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 0 10px;">
            <img src="${p.iconHeart}" width="18" height="18" alt="" style="display:block;border:0;margin:0 auto;" />
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 40px 28px;color:${mute};font-size:14px;line-height:1.6;${font}">
            Entre na sua &aacute;rea do cliente e reviva cada momento atrav&eacute;s das suas fotografias.
          </td>
        </tr>

        <tr>
          <td style="padding:0 40px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border-top:1px solid ${gold};font-size:0;line-height:0;height:1px;">&nbsp;</td>
                <td width="44" align="center" style="padding:0 6px;">
                  <img src="${p.iconLock}" width="18" height="18" alt="" style="display:block;border:0;margin:0 auto;" />
                </td>
                <td style="border-top:1px solid ${gold};font-size:0;line-height:0;height:1px;">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 36px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" style="padding-right:14px;">
                  <div style="width:44px;height:44px;border:1px solid ${gold};border-radius:50%;text-align:center;line-height:44px;">
                    <img src="${p.iconUser}" width="22" height="22" alt="" style="display:inline-block;vertical-align:middle;border:0;" />
                  </div>
                </td>
                <td valign="middle" style="${font}font-size:14px;line-height:1.5;color:${ink};text-align:left;">
                  <strong style="color:${gold};">Primeiro acesso?</strong><br />
                  Utilize o link abaixo para entrar:<br />
                  <a href="${p.loginUrl}" style="color:${gold};text-decoration:underline;">https://nox-fotografia.com.br</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:4px 0 16px;">
            <img src="${p.iconStar}" width="16" height="16" alt="" style="display:block;border:0;margin:0 auto;" />
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 28px 6px;color:${ink};font-size:15px;line-height:1.5;${font}">
            Com carinho,<br />
            <strong style="color:${gold};">NOX Fotografia</strong>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:8px 28px 22px;color:${mute};font-size:13px;font-style:italic;line-height:1.5;${font}">
            Momentos passam. Mem&oacute;rias permanecem.
          </td>
        </tr>

        <tr>
          <td style="padding:0 48px 18px;">
            <div style="border-top:1px solid ${gold};font-size:0;line-height:0;height:1px;">&nbsp;</div>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 28px 6px;color:#888888;font-size:11px;line-height:1.5;${font}">
            &copy; 2026 NOX Fotografia &middot; Todos os direitos reservados.
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:12px 32px 8px;color:${dim};font-size:11px;line-height:1.7;${font}">
            E-mail autom&aacute;tico &mdash; n&atilde;o responda.<br />
            D&uacute;vidas:
            <a href="${p.whatsappUrl}" style="color:${gold};text-decoration:none;">WhatsApp ${p.whatsapp}</a><br />
            Obrigado pela prefer&ecirc;ncia!
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}


function iconAttachment(filename: string, cid: string, content: string) {
  return {
    filename,
    content,
    encoding: 'base64' as const,
    contentType: 'image/png',
    cid,
    contentDisposition: 'inline' as const,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
