import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';
import { Observable } from 'rxjs';
import { Photo } from '../models/photo.model';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  getByAlbum(albumId: string): Observable<Photo[]> {
    const q = query(
      collection(this.firestore, 'photos'),
      where('albumId', '==', albumId),
      orderBy('createdAt', 'desc')
    );

    return new Observable<Photo[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map(
            (d) => ({ id: d.id, ...d.data() }) as Photo
          );
          subscriber.next(items);
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    });
  }

  async uploadPhoto(
    file: File,
    albumId: string,
    clientId: string,
    onProgress?: (pct: number) => void
  ): Promise<Photo> {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const storagePath = `clients/${clientId}/albums/${albumId}/${Date.now()}_${safeName}`;
    const storageRef = ref(this.storage, storagePath);

    const task = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
          onProgress?.(pct);
        },
        reject,
        () => resolve()
      );
    });

    const url = await getDownloadURL(storageRef);
    const photo: Omit<Photo, 'id'> = {
      albumId,
      url,
      filename: file.name,
      storagePath,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(this.firestore, 'photos'), photo);
    return { id: docRef.id, ...photo };
  }

  async deletePhoto(photo: Photo): Promise<void> {
    if (photo.storagePath) {
      try {
        await deleteObject(ref(this.storage, photo.storagePath));
      } catch {
        // arquivo pode já ter sido removido
      }
    }
    if (photo.id) {
      await deleteDoc(doc(this.firestore, `photos/${photo.id}`));
    }
  }
}
