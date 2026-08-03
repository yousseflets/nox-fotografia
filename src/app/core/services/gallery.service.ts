import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from '@angular/fire/firestore';
import {
  Storage,
  deleteObject,
  getBlob,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from '@angular/fire/storage';
import { Observable, catchError, of } from 'rxjs';
import { GalleryImage } from '../models/gallery-image.model';
import { createImageThumbnail } from '../utils/image-thumbnail';

@Injectable({ providedIn: 'root' })
export class GalleryService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  getAll(): Observable<GalleryImage[]> {
    const q = query(
      collection(this.firestore, 'gallery'),
      orderBy('createdAt', 'desc')
    );

    return new Observable<GalleryImage[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          subscriber.next(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GalleryImage)
          );
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    }).pipe(
      catchError((err) => {
        console.error('[GalleryService.getAll]', err);
        return of([]);
      })
    );
  }

  async upload(
    file: File,
    alt = '',
    onProgress?: (pct: number) => void
  ): Promise<string> {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const stamp = Date.now();
    const storagePath = `gallery/${stamp}_${safeName}`;
    const thumbStoragePath = `gallery/${stamp}_${safeName.replace(/\.[^.]+$/, '')}_thumb.jpg`;

    let thumbUrl: string | undefined;
    try {
      const thumbBlob = await createImageThumbnail(file, 1000, 0.75);
      onProgress?.(8);
      const thumb = await this.uploadBlob(thumbBlob, thumbStoragePath, (pct) =>
        onProgress?.(8 + pct * 0.17)
      );
      thumbUrl = thumb.url;
    } catch (err) {
      console.warn('[GalleryService] miniatura não gerada', err);
    }

    const original = await this.uploadBlob(file, storagePath, (pct) =>
      onProgress?.(25 + pct * 0.75)
    );

    const docRef = await addDoc(collection(this.firestore, 'gallery'), {
      url: original.url,
      alt: alt.trim() || 'Ensaio NOX Fotografia',
      storagePath,
      thumbUrl,
      thumbStoragePath: thumbUrl ? thumbStoragePath : undefined,
      createdAt: new Date().toISOString(),
    } satisfies Omit<GalleryImage, 'id'>);

    onProgress?.(100);
    return docRef.id;
  }

  /** Gera miniaturas para fotos antigas sem thumb (acelera o carrossel). */
  async generateMissingThumbnails(
    onProgress?: (done: number, total: number) => void
  ): Promise<number> {
    const snap = await getDocs(query(collection(this.firestore, 'gallery')));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as GalleryImage);
    const missing = items.filter((item) => item.id && item.storagePath && !item.thumbUrl);
    let done = 0;

    for (const item of missing) {
      try {
        const blob = await getBlob(ref(this.storage, item.storagePath));
        const file = new File([blob], item.storagePath.split('/').pop() || 'foto.jpg', {
          type: blob.type || 'image/jpeg',
        });
        const thumbBlob = await createImageThumbnail(file, 1000, 0.75);
        const thumbStoragePath = `gallery/${item.id}_thumb.jpg`;
        const uploaded = await this.uploadBlob(thumbBlob, thumbStoragePath);
        await updateDoc(doc(this.firestore, `gallery/${item.id}`), {
          thumbUrl: uploaded.url,
          thumbStoragePath,
        });
      } catch (err) {
        console.warn('[GalleryService] falha ao otimizar', item.id, err);
      }
      done += 1;
      onProgress?.(done, missing.length);
    }

    return missing.length;
  }

  async delete(image: GalleryImage): Promise<void> {
    for (const path of [image.storagePath, image.thumbStoragePath]) {
      if (!path) continue;
      try {
        await deleteObject(ref(this.storage, path));
      } catch {
        // arquivo pode já ter sido removido
      }
    }
    if (image.id) {
      await deleteDoc(doc(this.firestore, `gallery/${image.id}`));
    }
  }

  private uploadBlob(
    data: Blob | File,
    storagePath: string,
    onProgress?: (pct: number) => void
  ): Promise<{ url: string; storagePath: string }> {
    const storageRef = ref(this.storage, storagePath);
    const task = uploadBytesResumable(storageRef, data);

    return new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
        reject,
        async () => {
          try {
            const url = await getDownloadURL(storageRef);
            resolve({ url, storagePath });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }
}
