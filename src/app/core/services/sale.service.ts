import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  getDoc,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, catchError, of } from 'rxjs';
import { SaleEvent, slugify } from '../models/sale-event.model';
import { SalePhoto, salePhotoPreview } from '../models/sale-photo.model';
import { SaleOrder, SaleOrderBuyer, SaleOrderItem, SaleOrderStatus, SalePaymentMethod, SaleOrderDownloadFile } from '../models/sale-order.model';
import { createImageThumbnail } from '../utils/image-thumbnail';
import { createWatermarkedPreview } from '../utils/image-watermark';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly functions = inject(Functions);

  getEvents(activeOnly = false): Observable<SaleEvent[]> {
    // Sem orderBy no admin: evita falha silenciosa e ordena no cliente.
    const q = activeOnly
      ? query(collection(this.firestore, 'saleEvents'), where('active', '==', true))
      : query(collection(this.firestore, 'saleEvents'));

    return new Observable<SaleEvent[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SaleEvent);
          items.sort((a, b) => {
            if (activeOnly) {
              return (b.eventDate || '').localeCompare(a.eventDate || '');
            }
            return (b.createdAt || '').localeCompare(a.createdAt || '');
          });
          subscriber.next(items);
        },
        (err) => {
          console.error('[SaleService.getEvents]', err);
          subscriber.error(err);
        }
      );
      return () => unsub();
    });
  }

  getEventById(id: string): Observable<SaleEvent | undefined> {
    const refDoc = doc(this.firestore, `saleEvents/${id}`);
    return new Observable<SaleEvent | undefined>((subscriber) => {
      const unsub = onSnapshot(
        refDoc,
        (snap) => {
          if (!snap.exists()) {
            subscriber.next(undefined);
            return;
          }
          subscriber.next({ id: snap.id, ...snap.data() } as SaleEvent);
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    });
  }

  getEventBySlug(slug: string): Observable<SaleEvent | undefined> {
    const q = query(collection(this.firestore, 'saleEvents'), where('slug', '==', slug));
    return new Observable<SaleEvent | undefined>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const first = snap.docs[0];
          subscriber.next(
            first ? ({ id: first.id, ...first.data() } as SaleEvent) : undefined
          );
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    });
  }

  async createEvent(
    input: Omit<SaleEvent, 'id' | 'slug' | 'createdAt' | 'coverUrl'> & { title: string }
  ): Promise<string> {
    const baseSlug = slugify(input.title) || `evento-${Date.now()}`;
    let slug = `${baseSlug}-${Date.now().toString(36)}`;
    try {
      slug = await this.uniqueSlug(baseSlug);
    } catch (err) {
      console.warn('[SaleService.uniqueSlug]', err);
    }
    const priceCents = Math.round(Number(input.priceCents));
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      throw new Error('Preco invalido');
    }
    const refDoc = await addDoc(collection(this.firestore, 'saleEvents'), {
      title: input.title,
      eventDate: input.eventDate,
      description: input.description || '',
      priceCents,
      active: !!input.active,
      slug,
      createdAt: new Date().toISOString(),
    });
    return refDoc.id;
  }

  async updateEvent(id: string, data: Partial<SaleEvent>): Promise<void> {
    const { id: _id, ...rest } = data;
    await updateDoc(doc(this.firestore, `saleEvents/${id}`), rest);
  }

  async deleteEvent(id: string): Promise<void> {
    const photos = await this.getPhotosOnce(id);
    for (const photo of photos) {
      await this.deletePhoto(photo);
    }
    await deleteDoc(doc(this.firestore, `saleEvents/${id}`));
  }

  getPhotos(eventId: string): Observable<SalePhoto[]> {
    const q = query(
      collection(this.firestore, 'salePhotos'),
      where('eventId', '==', eventId)
    );
    return new Observable<SalePhoto[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SalePhoto);
          subscriber.next(
            items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          );
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    }).pipe(
      catchError((err) => {
        console.error('[SaleService.getPhotos]', err);
        return of([]);
      })
    );
  }

  async uploadPhoto(
    file: File,
    eventId: string,
    onProgress?: (pct: number) => void
  ): Promise<SalePhoto> {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const stamp = Date.now();
    const base = `sales/${eventId}`;
    const storagePath = `${base}/originals/${stamp}_${safeName}`;
    const previewStoragePath = `${base}/previews/${stamp}_${safeName.replace(/\.[^.]+$/, '')}_wm.jpg`;
    const thumbStoragePath = `${base}/thumbs/${stamp}_${safeName.replace(/\.[^.]+$/, '')}_thumb.jpg`;

    onProgress?.(5);
    const previewBlob = await createWatermarkedPreview(file);
    onProgress?.(15);
    // Thumb tambem com marca d'agua (derivado do preview).
    const thumbBlob = await createImageThumbnail(
      new File([previewBlob], 'preview.jpg', { type: 'image/jpeg' })
    );

    const previewUrl = await this.uploadBlob(previewBlob, previewStoragePath, (p) =>
      onProgress?.(15 + p * 0.25)
    );
    const thumbUrl = await this.uploadBlob(thumbBlob, thumbStoragePath, (p) =>
      onProgress?.(40 + p * 0.15)
    );
    // Original sobe sem URL p\u00fablica (download s\u00f3 via Function ap\u00f3s pagamento).
    await this.uploadBlob(file, storagePath, (p) => onProgress?.(55 + p * 0.4));

    const photo: Omit<SalePhoto, 'id'> = {
      eventId,
      url: '',
      storagePath,
      previewUrl,
      previewStoragePath,
      thumbUrl,
      thumbStoragePath,
      filename: file.name,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(this.firestore, 'salePhotos'), photo);
    onProgress?.(100);
    return { id: docRef.id, ...photo };
  }

  async ensureCover(eventId: string, coverUrl: string): Promise<void> {
    await updateDoc(doc(this.firestore, `saleEvents/${eventId}`), { coverUrl });
  }

  async deletePhoto(photo: SalePhoto): Promise<void> {
    for (const path of [
      photo.storagePath,
      photo.previewStoragePath,
      photo.thumbStoragePath,
    ]) {
      if (!path) continue;
      try {
        await deleteObject(ref(this.storage, path));
      } catch {
        // arquivo ja removido
      }
    }
    if (photo.id) {
      await deleteDoc(doc(this.firestore, `salePhotos/${photo.id}`));
    }
  }

  async createPixOrder(input: {
    eventId: string;
    photoIds: string[];
    buyer: SaleOrderBuyer;
    items: SaleOrderItem[];
  }): Promise<{ orderId: string; accessToken: string }> {
    const eventSnap = await getDoc(doc(this.firestore, `saleEvents/${input.eventId}`));
    if (!eventSnap.exists()) {
      throw new Error('Evento nao encontrado.');
    }
    const event = eventSnap.data() as SaleEvent;
    if (!event.active) {
      throw new Error('Evento indisponivel.');
    }

    const priceCents = Number(event.priceCents);
    if (!Number.isFinite(priceCents) || priceCents < 1) {
      throw new Error('Preco do evento invalido.');
    }

    const photoSnaps = await Promise.all(
      input.photoIds.map((id) => getDoc(doc(this.firestore, `salePhotos/${id}`)))
    );

    const items: SaleOrderItem[] = [];
    for (let i = 0; i < photoSnaps.length; i++) {
      const snap = photoSnaps[i];
      if (!snap.exists()) {
        throw new Error(`Foto nao encontrada: ${input.photoIds[i]}`);
      }
      const photo = snap.data() as SalePhoto;
      if (photo.eventId !== input.eventId) {
        throw new Error('Foto nao pertence ao evento.');
      }
      items.push({
        photoId: snap.id,
        eventId: input.eventId,
        filename: photo.filename,
        previewUrl: photo.thumbUrl || photo.previewUrl,
        priceCents,
      });
    }

    const totalCents = items.length * priceCents;
    const accessToken = crypto.randomUUID().replace(/-/g, '');

    const orderRef = await addDoc(collection(this.firestore, 'orders'), {
      eventId: input.eventId,
      eventTitle: event.title,
      items,
      buyer: {
        name: input.buyer.name.trim(),
        email: input.buyer.email.trim().toLowerCase(),
        phone: input.buyer.phone.trim(),
        cpf: input.buyer.cpf.replace(/\D/g, ''),
      },
      paymentMethod: 'pix',
      status: 'pending',
      totalCents,
      accessToken,
      createdAt: new Date().toISOString(),
    });

    return { orderId: orderRef.id, accessToken };
  }

  async createInfinitePayCheckout(input: {
    eventId: string;
    photoIds: string[];
    buyer: SaleOrderBuyer;
  }): Promise<{ orderId: string; accessToken: string; checkoutUrl: string }> {
    const callable = httpsCallable<
      typeof input,
      { orderId: string; accessToken: string; checkoutUrl: string }
    >(this.functions, 'createInfinitePayCheckout');
    const result = await callable(input);
    return result.data;
  }

  async syncInfinitePayPayment(input: {
    orderId: string;
    accessToken: string;
    slug?: string;
    transactionNsu?: string;
  }): Promise<{ paid: boolean }> {
    const callable = httpsCallable<
      typeof input,
      { paid: boolean }
    >(this.functions, 'syncInfinitePayPayment');
    const result = await callable(input);
    return result.data;
  }

  async createCheckout(input: {
    eventId: string;
    photoIds: string[];
    buyer: SaleOrderBuyer;
    paymentMethod: SalePaymentMethod;
  }): Promise<{
    orderId: string;
    accessToken?: string;
    initPoint?: string;
    sandboxInitPoint?: string;
  }> {
    const callable = httpsCallable<
      typeof input,
      {
        orderId: string;
        accessToken?: string;
        initPoint?: string;
        sandboxInitPoint?: string;
      }
    >(this.functions, 'createSaleCheckout');
    const result = await callable(input);
    return result.data;
  }

  getOrders(): Observable<SaleOrder[]> {
    const q = query(collection(this.firestore, 'orders'));
    return new Observable<SaleOrder[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SaleOrder);
          items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          subscriber.next(items);
        },
        (err) => {
          console.error('[SaleService.getOrders]', err);
          subscriber.error(err);
        }
      );
      return () => unsub();
    });
  }

  async updateOrderStatus(orderId: string, status: SaleOrderStatus): Promise<void> {
    const payload: Partial<Pick<SaleOrder, 'status' | 'paidAt'>> = { status };
    if (status === 'paid') {
      payload.paidAt = new Date().toISOString();
    }
    await updateDoc(doc(this.firestore, `orders/${orderId}`), payload);
  }

  async deleteOrder(orderId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, `orders/${orderId}`));
  }

  /** Gera URLs de download (admin autenticado) e grava no pedido. */
  async prepareOrderDownloads(orderId: string): Promise<SaleOrderDownloadFile[]> {
    const orderSnap = await getDoc(doc(this.firestore, `orders/${orderId}`));
    if (!orderSnap.exists()) {
      throw new Error('Pedido n\u00e3o encontrado.');
    }
    const order = { id: orderSnap.id, ...orderSnap.data() } as SaleOrder;
    if (order.status !== 'paid') {
      throw new Error('Confirme o pagamento antes de liberar os downloads.');
    }

    const files: SaleOrderDownloadFile[] = [];
    for (const item of order.items) {
      const photoSnap = await getDoc(doc(this.firestore, `salePhotos/${item.photoId}`));
      if (!photoSnap.exists()) {
        throw new Error(`Foto n\u00e3o encontrada: ${item.filename}`);
      }
      const photo = photoSnap.data() as SalePhoto;
      if (!photo.storagePath) {
        throw new Error(`Arquivo original ausente: ${item.filename}`);
      }
      const url = await getDownloadURL(ref(this.storage, photo.storagePath));
      files.push({
        filename: photo.filename || item.filename,
        url,
      });
    }

    if (!files.length) {
      throw new Error('Nenhuma foto encontrada neste pedido.');
    }

    await updateDoc(doc(this.firestore, `orders/${orderId}`), { downloadFiles: files });
    return files;
  }

  getOrder(orderId: string): Observable<SaleOrder | undefined> {
    const refDoc = doc(this.firestore, `orders/${orderId}`);
    return new Observable<SaleOrder | undefined>((subscriber) => {
      const unsub = onSnapshot(
        refDoc,
        (snap) => {
          if (!snap.exists()) {
            subscriber.next(undefined);
            return;
          }
          subscriber.next({ id: snap.id, ...snap.data() } as SaleOrder);
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    });
  }

  async getDownloads(
    orderId: string,
    accessToken: string
  ): Promise<{ filename: string; url: string }[]> {
    const callable = httpsCallable<
      { orderId: string; accessToken: string },
      { files: { filename: string; url: string }[] }
    >(this.functions, 'getOrderDownloads');
    const result = await callable({ orderId, accessToken });
    return result.data.files;
  }

  previewUrl = salePhotoPreview;

  private async getPhotosOnce(eventId: string): Promise<SalePhoto[]> {
    const snap = await getDocs(
      query(collection(this.firestore, 'salePhotos'), where('eventId', '==', eventId))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SalePhoto);
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    let i = 2;
    while (true) {
      const snap = await getDocs(
        query(collection(this.firestore, 'saleEvents'), where('slug', '==', slug))
      );
      if (snap.empty) return slug;
      slug = `${base}-${i++}`;
    }
  }

  private uploadBlob(
    data: Blob | File,
    path: string,
    onProgress?: (pct: number) => void
  ): Promise<string> {
    const storageRef = ref(this.storage, path);
    const task = uploadBytesResumable(storageRef, data);
    return new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          if (snap.totalBytes) {
            onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
          }
        },
        reject,
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      );
    });
  }
}
