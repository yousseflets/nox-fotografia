import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from '@angular/fire/firestore';
import {
  Storage,
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from '@angular/fire/storage';
import { Observable, catchError, of } from 'rxjs';
import { GalleryImage } from '../models/gallery-image.model';

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
    const storagePath = `gallery/${Date.now()}_${safeName}`;
    const storageRef = ref(this.storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100);
        },
        reject,
        () => resolve()
      );
    });

    const url = await getDownloadURL(storageRef);
    const docRef = await addDoc(collection(this.firestore, 'gallery'), {
      url,
      alt: alt.trim() || 'Ensaio NOX Fotografia',
      storagePath,
      createdAt: new Date().toISOString(),
    } satisfies Omit<GalleryImage, 'id'>);

    return docRef.id;
  }

  async delete(image: GalleryImage): Promise<void> {
    if (image.storagePath) {
      try {
        await deleteObject(ref(this.storage, image.storagePath));
      } catch {
        // arquivo pode já ter sido removido
      }
    }
    if (image.id) {
      await deleteDoc(doc(this.firestore, `gallery/${image.id}`));
    }
  }
}
