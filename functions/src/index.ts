import { randomBytes, timingSafeEqual } from 'crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';

initializeApp();
setGlobalOptions({ region: 'us-central1' });

const mpAccessToken = defineSecret('MP_ACCESS_TOKEN');
const siteUrl = defineString('SITE_URL', {
  default: 'https://www.nox-fotografia.com.br',
});

type Buyer = { name: string; email: string; phone: string; cpf: string };
type PaymentMethod = 'pix' | 'credit_card';

type CheckoutInput = {
  eventId: string;
  photoIds: string[];
  buyer: Buyer;
  paymentMethod: PaymentMethod;
};

function formatPriceBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function onlyDigits(value: string): string {
  return String(value || '').replace(/\D/g, '');
}

function newAccessToken(): string {
  return randomBytes(24).toString('hex');
}

function mpClient(token: string) {
  return new MercadoPagoConfig({ accessToken: token });
}

export const createSaleCheckout = onCall(
  { secrets: [mpAccessToken], cors: true },
  async (request) => {
    const data = request.data as CheckoutInput;
    const eventId = String(data?.eventId || '').trim();
    const photoIds = Array.isArray(data?.photoIds)
      ? [...new Set(data.photoIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];
    const buyer = data?.buyer;
    const paymentMethod = data?.paymentMethod === 'credit_card' ? 'credit_card' : 'pix';

    if (!eventId || !photoIds.length) {
      throw new HttpsError('invalid-argument', 'Evento e fotos sao obrigatorios.');
    }
    if (!buyer?.name?.trim() || !buyer?.email?.trim() || !buyer?.phone?.trim()) {
      throw new HttpsError('invalid-argument', 'Dados do comprador incompletos.');
    }
    const cpf = onlyDigits(buyer.cpf || '');
    if (cpf.length < 11) {
      throw new HttpsError('invalid-argument', 'CPF invalido.');
    }

    const db = getFirestore();
    const eventSnap = await db.doc(`saleEvents/${eventId}`).get();
    if (!eventSnap.exists) {
      throw new HttpsError('not-found', 'Evento nao encontrado.');
    }
    const event = eventSnap.data()!;
    if (!event['active']) {
      throw new HttpsError('failed-precondition', 'Evento indisponivel.');
    }

    const priceCents = Number(event['priceCents']);
    if (!Number.isFinite(priceCents) || priceCents < 1) {
      throw new HttpsError('failed-precondition', 'Preco do evento invalido.');
    }

    const photoSnaps = await Promise.all(
      photoIds.map((id) => db.doc(`salePhotos/${id}`).get())
    );
    const photos: Array<Record<string, unknown> & { id: string }> = photoSnaps.map(
      (snap, i) => {
        if (!snap.exists) {
          throw new HttpsError('not-found', `Foto nao encontrada: ${photoIds[i]}`);
        }
        const photo = snap.data() as Record<string, unknown>;
        if (photo['eventId'] !== eventId) {
          throw new HttpsError('invalid-argument', 'Foto nao pertence ao evento.');
        }
        return { id: snap.id, ...photo };
      }
    );

    const items = photos.map((photo) => ({
      photoId: photo.id,
      eventId,
      filename: String(photo['filename'] || photo.id),
      previewUrl: String(photo['thumbUrl'] || photo['previewUrl'] || ''),
      priceCents,
    }));
    const totalCents = items.length * priceCents;
    const accessToken = newAccessToken();
    const orderRef = db.collection('orders').doc();
    const orderId = orderRef.id;
    const base = siteUrl.value().replace(/\/$/, '');
    const returnUrl = `${base}/fotos/pedido/${orderId}?token=${accessToken}`;

    const token = mpAccessToken.value();
    if (!token) {
      throw new HttpsError('failed-precondition', 'Mercado Pago nao configurado.');
    }

    const preference = new Preference(mpClient(token));
    const excluded =
      paymentMethod === 'pix'
        ? [
            { id: 'credit_card' },
            { id: 'debit_card' },
            { id: 'ticket' },
            { id: 'atm' },
          ]
        : [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }];

    const created = await preference.create({
      body: {
        external_reference: orderId,
        notification_url: `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/mercadopagoWebhook`,
        back_urls: {
          success: returnUrl,
          failure: returnUrl,
          pending: returnUrl,
        },
        auto_return: 'approved',
        payer: {
          name: buyer.name.trim(),
          email: buyer.email.trim(),
          phone: { number: onlyDigits(buyer.phone) },
          identification: { type: 'CPF', number: cpf },
        },
        items: items.map((item) => ({
          id: item.photoId,
          title: `${event['title']} — ${item.filename}`.slice(0, 250),
          quantity: 1,
          unit_price: Number((item.priceCents / 100).toFixed(2)),
          currency_id: 'BRL',
        })),
        payment_methods: {
          excluded_payment_types: excluded,
          installments: paymentMethod === 'credit_card' ? 12 : 1,
        },
        metadata: {
          orderId,
          eventId,
        },
      },
    });

    await orderRef.set({
      eventId,
      eventTitle: String(event['title'] || ''),
      items,
      buyer: {
        name: buyer.name.trim(),
        email: buyer.email.trim().toLowerCase(),
        phone: buyer.phone.trim(),
        cpf,
      },
      paymentMethod,
      status: 'pending',
      totalCents,
      mpPreferenceId: created.id,
      accessToken,
      createdAt: new Date().toISOString(),
    });

    return {
      orderId,
      accessToken,
      initPoint: created.init_point,
      sandboxInitPoint: created.sandbox_init_point,
    };
  }
);

export const mercadopagoWebhook = onRequest(
  { secrets: [mpAccessToken], cors: false },
  async (req, res) => {
    try {
      if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).send('Method not allowed');
        return;
      }

      const type = String(req.query['type'] || req.body?.type || '');
      const topic = String(req.query['topic'] || req.body?.topic || '');
      const dataId = String(
        req.query['data.id'] ||
          req.query['id'] ||
          req.body?.data?.id ||
          req.body?.id ||
          ''
      );

      const isPayment = type === 'payment' || topic === 'payment';
      if (!isPayment || !dataId) {
        res.status(200).send('ignored');
        return;
      }

      const token = mpAccessToken.value();
      const paymentApi = new Payment(mpClient(token));
      const payment = await paymentApi.get({ id: dataId });
      const status = String(payment.status || '');
      const orderId = String(payment.external_reference || '');
      if (!orderId) {
        res.status(200).send('no-order');
        return;
      }

      const db = getFirestore();
      const orderRef = db.doc(`orders/${orderId}`);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        res.status(200).send('order-missing');
        return;
      }

      const order = orderSnap.data()!;
      const buyer = (order['buyer'] || {}) as { email?: string; name?: string };
      if (status === 'approved' && order['status'] !== 'paid') {
        await orderRef.update({
          status: 'paid',
          mpPaymentId: String(payment.id || dataId),
          paidAt: new Date().toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        await enqueuePaidEmail({
          to: String(buyer.email || ''),
          name: String(buyer.name || ''),
          eventTitle: String(order['eventTitle'] || ''),
          orderId,
          accessToken: String(order['accessToken'] || ''),
          totalCents: Number(order['totalCents'] || 0),
        });
      } else if (status === 'cancelled' || status === 'rejected') {
        if (order['status'] === 'pending') {
          await orderRef.update({
            status: status === 'cancelled' ? 'cancelled' : 'failed',
            mpPaymentId: String(payment.id || dataId),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      res.status(200).send('ok');
    } catch (err) {
      console.error('[mercadopagoWebhook]', err);
      res.status(500).send('error');
    }
  }
);

export const getOrderDownloads = onCall({ cors: true }, async (request) => {
  const orderId = String(request.data?.orderId || '').trim();
  const accessToken = String(request.data?.accessToken || '').trim();
  if (!orderId || !accessToken) {
    throw new HttpsError('invalid-argument', 'Pedido e token obrigatorios.');
  }

  const db = getFirestore();
  const orderSnap = await db.doc(`orders/${orderId}`).get();
  if (!orderSnap.exists) {
    throw new HttpsError('not-found', 'Pedido nao encontrado.');
  }
  const order = orderSnap.data()!;
  if (order['status'] !== 'paid') {
    throw new HttpsError('failed-precondition', 'Pagamento ainda nao aprovado.');
  }

  const expected = String(order['accessToken'] || '');
  if (!tokensMatch(expected, accessToken)) {
    throw new HttpsError('permission-denied', 'Token invalido.');
  }

  const items = Array.isArray(order['items']) ? order['items'] : [];
  const bucket = getStorage().bucket();
  const files: { filename: string; url: string }[] = [];

  for (const item of items) {
    const photoId = String(item?.photoId || '');
    if (!photoId) continue;
    const photoSnap = await db.doc(`salePhotos/${photoId}`).get();
    if (!photoSnap.exists) continue;
    const photo = photoSnap.data()!;
    const storagePath = String(photo['storagePath'] || '');
    const filename = String(photo['filename'] || item.filename || photoId);
    if (!storagePath) continue;

    const [url] = await bucket.file(storagePath).getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      responseDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    });
    files.push({ filename, url });
  }

  return { files };
});

async function enqueuePaidEmail(input: {
  to: string;
  name: string;
  eventTitle: string;
  orderId: string;
  accessToken: string;
  totalCents: number;
}): Promise<void> {
  const to = input.to.trim();
  if (!to) return;

  const base = siteUrl.value().replace(/\/$/, '');
  const orderUrl = `${base}/fotos/pedido/${input.orderId}?token=${input.accessToken}`;
  const name = input.name.trim() || 'cliente';
  const total = formatPriceBRL(input.totalCents);
  const subject = `NOX Fotografia — Pagamento confirmado (${input.eventTitle})`;
  const text = [
    `Ola, ${name}!`,
    '',
    'Seu pagamento foi aprovado.',
    `Evento: ${input.eventTitle}`,
    `Total: ${total}`,
    '',
    `Baixe suas fotos (sem marca d'agua): ${orderUrl}`,
    '',
    'NOX Fotografia',
    'Momentos passam. Memorias permanecem.',
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;background:#0a0a0a;color:#f5f0e6;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #d4af37;border-radius:12px;padding:28px;">
        <tr><td align="center" style="padding-bottom:16px;">
          <img src="${base}/nox-logo.png" alt="NOX Fotografia" width="120" style="display:block;" />
        </td></tr>
        <tr><td style="color:#d4af37;font-size:22px;padding-bottom:12px;">Pagamento confirmado</td></tr>
        <tr><td style="color:#f5f0e6;font-size:16px;line-height:1.5;padding-bottom:12px;">
          Ola, ${escapeHtml(name)}! Suas fotos de <strong>${escapeHtml(input.eventTitle)}</strong>
          (${escapeHtml(total)}) estao prontas para download sem marca d'agua.
        </td></tr>
        <tr><td align="center" style="padding:18px 0;">
          <a href="${escapeHtml(orderUrl)}"
             style="display:inline-block;background:#d4af37;color:#0a0a0a;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700;">
            Baixar fotos
          </a>
        </td></tr>
        <tr><td style="color:#9a9284;font-size:12px;line-height:1.4;">
          E-mail automatico — nao responda.<br/>
          <a href="${base}" style="color:#d4af37;">nox-fotografia.com.br</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  await getFirestore().collection('mail').add({
    to: [to],
    message: { subject, text, html },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tokensMatch(expected: string, provided: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
