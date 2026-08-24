import { randomBytes, timingSafeEqual } from 'crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { setGlobalOptions } from 'firebase-functions/v2';

initializeApp();
setGlobalOptions({ region: 'us-central1' });

const siteUrl = defineString('SITE_URL', {
  default: 'https://www.nox-fotografia.com.br',
});
const infinitePayHandle = defineString('INFINITEPAY_HANDLE', {
  default: 'thaisroza',
});

const INFINITE_PAY_API = 'https://api.checkout.infinitepay.io';

type Buyer = { name: string; email: string; phone: string; cpf: string };
type PaymentMethod = 'pix' | 'credit_card';

type CheckoutInput = {
  eventId: string;
  photoIds: string[];
  buyer: Buyer;
  paymentMethod?: PaymentMethod;
};

type OrderItem = {
  photoId: string;
  eventId: string;
  filename: string;
  previewUrl: string;
  priceCents: number;
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

function formatPhoneBR(phone: string): string {
  const digits = onlyDigits(phone);
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`;
  if (digits.length >= 10) return `+55${digits}`;
  return `+55${digits}`;
}

function webhookBaseUrl(): string {
  return `https://us-central1-${process.env.GCLOUD_PROJECT}.cloudfunctions.net`;
}

async function loadOrderItems(
  db: Firestore,
  eventId: string,
  photoIds: string[],
  priceCents: number
): Promise<{ items: OrderItem[]; eventTitle: string }> {
  const eventSnap = await db.doc(`saleEvents/${eventId}`).get();
  if (!eventSnap.exists) {
    throw new HttpsError('not-found', 'Evento nao encontrado.');
  }
  const event = eventSnap.data()!;
  if (!event['active']) {
    throw new HttpsError('failed-precondition', 'Evento indisponivel.');
  }
  if (!Number.isFinite(priceCents) || priceCents < 1) {
    throw new HttpsError('failed-precondition', 'Preco do evento invalido.');
  }

  const photoSnaps = await Promise.all(
    photoIds.map((id) => db.doc(`salePhotos/${id}`).get())
  );
  const items: OrderItem[] = photoSnaps.map((snap, i) => {
    if (!snap.exists) {
      throw new HttpsError('not-found', `Foto nao encontrada: ${photoIds[i]}`);
    }
    const photo = snap.data() as Record<string, unknown>;
    if (photo['eventId'] !== eventId) {
      throw new HttpsError('invalid-argument', 'Foto nao pertence ao evento.');
    }
    return {
      photoId: snap.id,
      eventId,
      filename: String(photo['filename'] || snap.id),
      previewUrl: String(photo['thumbUrl'] || photo['previewUrl'] || ''),
      priceCents,
    };
  });

  return { items, eventTitle: String(event['title'] || '') };
}

async function getStorageDownloadUrl(storagePath: string): Promise<string> {
  const bucket = getStorage().bucket();
  const file = bucket.file(storagePath);
  const [metadata] = await file.getMetadata();
  const meta = (metadata.metadata || {}) as Record<string, string>;
  let token = String(meta.firebaseStorageDownloadTokens || '').split(',')[0].trim();
  if (!token) {
    token = randomBytes(16).toString('hex');
    await file.setMetadata({
      metadata: { ...meta, firebaseStorageDownloadTokens: token },
    });
  }
  const encoded = encodeURIComponent(storagePath);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encoded}?alt=media&token=${token}`;
}

async function buildDownloadFiles(
  db: Firestore,
  order: FirebaseFirestore.DocumentData
): Promise<{ filename: string; url: string }[]> {
  const items = Array.isArray(order['items']) ? order['items'] : [];
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

    const url = await getStorageDownloadUrl(storagePath);
    files.push({ filename, url });
  }

  return files;
}

async function fulfillOrderDownloads(
  db: Firestore,
  orderId: string,
  order: FirebaseFirestore.DocumentData
): Promise<{ filename: string; url: string }[]> {
  const existing = Array.isArray(order['downloadFiles']) ? order['downloadFiles'] : [];
  if (existing.length) {
    return existing as { filename: string; url: string }[];
  }

  const files = await buildDownloadFiles(db, order);
  if (files.length) {
    await db.doc(`orders/${orderId}`).update({ downloadFiles: files });
  }
  return files;
}

async function markOrderPaidAndFulfill(
  orderId: string,
  extra: Record<string, unknown>
): Promise<boolean> {
  const db = getFirestore();
  const orderRef = db.doc(`orders/${orderId}`);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) return false;

  const order = orderSnap.data()!;
  const alreadyPaid = order['status'] === 'paid';

  if (!alreadyPaid) {
    await orderRef.update({
      status: 'paid',
      paidAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
      ...extra,
    });
  } else if (Object.keys(extra).length) {
    await orderRef.update({ ...extra, updatedAt: FieldValue.serverTimestamp() });
  }

  const freshSnap = await orderRef.get();
  const fresh = freshSnap.data()!;
  await fulfillOrderDownloads(db, orderId, fresh);

  if (!alreadyPaid) {
    const buyer = (order['buyer'] || {}) as { email?: string; name?: string };
    await enqueuePaidEmail({
      to: String(buyer.email || ''),
      name: String(buyer.name || ''),
      eventTitle: String(order['eventTitle'] || ''),
      orderId,
      accessToken: String(order['accessToken'] || ''),
      totalCents: Number(order['totalCents'] || 0),
    });
  }

  return true;
}

async function createInfinitePayLink(body: Record<string, unknown>): Promise<{
  checkoutUrl: string;
  slug?: string;
}> {
  const res = await fetch(`${INFINITE_PAY_API}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message = String(data['message'] || 'Erro ao criar checkout InfinitePay.');
    throw new HttpsError('failed-precondition', message);
  }

  const checkoutUrl = String(data['checkout_url'] || data['url'] || data['link'] || '');
  if (!checkoutUrl) {
    throw new HttpsError('internal', 'InfinitePay nao retornou link de checkout.');
  }

  return {
    checkoutUrl,
    slug: data['slug'] ? String(data['slug']) : undefined,
  };
}

async function checkInfinitePayPayment(input: {
  handle: string;
  order_nsu: string;
  transaction_nsu: string;
  slug: string;
}): Promise<{ paid: boolean; capture_method?: string }> {
  const res = await fetch(`${INFINITE_PAY_API}/payment_check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !data['success']) {
    return { paid: false };
  }
  return {
    paid: !!data['paid'],
    capture_method: data['capture_method'] ? String(data['capture_method']) : undefined,
  };
}

function paymentMethodFromCapture(capture?: string): PaymentMethod {
  return capture === 'credit_card' ? 'credit_card' : 'pix';
}

export const createInfinitePayCheckout = onCall({ cors: true }, async (request) => {
  const data = request.data as CheckoutInput;
  const eventId = String(data?.eventId || '').trim();
  const photoIds = Array.isArray(data?.photoIds)
    ? [...new Set(data.photoIds.map((id) => String(id).trim()).filter(Boolean))]
    : [];
  const buyer = data?.buyer;

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
  const priceCents = Number(eventSnap.data()!['priceCents']);
  const { items, eventTitle } = await loadOrderItems(db, eventId, photoIds, priceCents);

  const accessToken = newAccessToken();
  const orderRef = db.collection('orders').doc();
  const orderId = orderRef.id;
  const base = siteUrl.value().replace(/\/$/, '');
  const returnUrl = `${base}/fotos/pedido/${orderId}?token=${accessToken}`;
  const handle = infinitePayHandle.value().replace(/^\$/, '').trim();

  if (!handle) {
    throw new HttpsError('failed-precondition', 'InfinitePay handle nao configurado.');
  }

  const { checkoutUrl, slug } = await createInfinitePayLink({
    handle,
    order_nsu: orderId,
    redirect_url: returnUrl,
    webhook_url: `${webhookBaseUrl()}/infinitepayWebhook`,
    customer: {
      name: buyer.name.trim(),
      email: buyer.email.trim().toLowerCase(),
      phone_number: formatPhoneBR(buyer.phone),
    },
    items: items.map((item) => ({
      quantity: 1,
      price: item.priceCents,
      description: `${eventTitle} — ${item.filename}`.slice(0, 250),
    })),
  });

  await orderRef.set({
    eventId,
    eventTitle,
    items,
    buyer: {
      name: buyer.name.trim(),
      email: buyer.email.trim().toLowerCase(),
      phone: buyer.phone.trim(),
      cpf,
    },
    paymentProvider: 'infinitepay',
    paymentMethod: 'pix',
    status: 'pending',
    totalCents: items.length * priceCents,
    accessToken,
    checkoutUrl,
    ipSlug: slug || '',
    createdAt: new Date().toISOString(),
  });

  return { orderId, accessToken, checkoutUrl };
});

export const syncInfinitePayPayment = onCall({ cors: true }, async (request) => {
  const orderId = String(request.data?.orderId || '').trim();
  const accessToken = String(request.data?.accessToken || '').trim();
  const slug = String(request.data?.slug || '').trim();
  const transactionNsu = String(request.data?.transactionNsu || '').trim();

  if (!orderId || !accessToken) {
    throw new HttpsError('invalid-argument', 'Pedido e token obrigatorios.');
  }

  const db = getFirestore();
  const orderSnap = await db.doc(`orders/${orderId}`).get();
  if (!orderSnap.exists) {
    throw new HttpsError('not-found', 'Pedido nao encontrado.');
  }

  const order = orderSnap.data()!;
  const expected = String(order['accessToken'] || '');
  if (!tokensMatch(expected, accessToken)) {
    throw new HttpsError('permission-denied', 'Token invalido.');
  }

  if (order['status'] === 'paid') {
    await fulfillOrderDownloads(db, orderId, order);
    return { paid: true };
  }

  const resolvedSlug = slug || String(order['ipSlug'] || '').trim();
  const resolvedTxn = transactionNsu || String(order['ipTransactionNsu'] || '').trim();
  if (!resolvedSlug || !resolvedTxn) {
    return { paid: false };
  }

  const handle = infinitePayHandle.value().replace(/^\$/, '').trim();
  const check = await checkInfinitePayPayment({
    handle,
    order_nsu: orderId,
    transaction_nsu: resolvedTxn,
    slug: resolvedSlug,
  });

  if (!check.paid) {
    return { paid: false };
  }

  await markOrderPaidAndFulfill(orderId, {
    paymentProvider: 'infinitepay',
    paymentMethod: paymentMethodFromCapture(check.capture_method),
    ipSlug: resolvedSlug,
    ipTransactionNsu: resolvedTxn,
  });

  return { paid: true };
});

export const infinitepayWebhook = onRequest({ cors: false }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const orderId = String(body['order_nsu'] || '').trim();
    if (!orderId) {
      res.status(400).json({ success: false, message: 'order_nsu ausente' });
      return;
    }

    const db = getFirestore();
    const orderSnap = await db.doc(`orders/${orderId}`).get();
    if (!orderSnap.exists) {
      res.status(400).json({ success: false, message: 'Pedido nao encontrado' });
      return;
    }

    const order = orderSnap.data()!;
    if (order['status'] === 'paid') {
      res.status(200).json({ success: true, message: null });
      return;
    }

    const capture = body['capture_method'] ? String(body['capture_method']) : undefined;
    const slug = body['invoice_slug'] ? String(body['invoice_slug']) : String(order['ipSlug'] || '');
    const transactionNsu = body['transaction_nsu'] ? String(body['transaction_nsu']) : '';

    if (transactionNsu && slug) {
      const handle = infinitePayHandle.value().replace(/^\$/, '').trim();
      const check = await checkInfinitePayPayment({
        handle,
        order_nsu: orderId,
        transaction_nsu: transactionNsu,
        slug,
      });
      if (!check.paid) {
        res.status(200).json({ success: true, message: null });
        return;
      }
    }

    await markOrderPaidAndFulfill(orderId, {
      paymentProvider: 'infinitepay',
      paymentMethod: paymentMethodFromCapture(capture),
      ipSlug: slug,
      ipTransactionNsu: transactionNsu,
    });

    res.status(200).json({ success: true, message: null });
  } catch (err) {
    console.error('[infinitepayWebhook]', err);
    res.status(400).json({ success: false, message: 'Erro ao processar webhook' });
  }
});

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

  const files = await fulfillOrderDownloads(db, orderId, order);
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
