import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  getBlob,
  getBytes,
} from '@angular/fire/storage';
import { Observable, catchError, map, of } from 'rxjs';
import { Photo } from '../models/photo.model';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  getByAlbum(albumId: string): Observable<Photo[]> {
    // Sem orderBy no Firestore para nao exigir indice composto (albumId + createdAt).
    const q = query(
      collection(this.firestore, 'photos'),
      where('albumId', '==', albumId)
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
    }).pipe(
      map((list) =>
        [...list].sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || '')
        )
      ),
      catchError((err) => {
        console.error('[PhotoService.getByAlbum]', err);
        return of([]);
      })
    );
  }

  /** Baixa o arquivo original via SDK (sem reprocessar a imagem). */
  async getPhotoBytes(photo: Photo): Promise<Uint8Array> {
    if (photo.storagePath) {
      const buffer = await getBytes(ref(this.storage, photo.storagePath));
      return new Uint8Array(buffer);
    }
    const response = await fetch(photo.url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar foto (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  /** Baixa o arquivo via SDK (precisa de CORS no bucket). */
  async getPhotoBlob(photo: Photo): Promise<Blob> {
    if (photo.storagePath) {
      return getBlob(ref(this.storage, photo.storagePath));
    }
    const response = await fetch(photo.url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar foto (${response.status})`);
    }
    return response.blob();
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
        // arquivo pode jÃ¡ ter sido removido
      }
    }
    if (photo.id) {
      await deleteDoc(doc(this.firestore, `photos/${photo.id}`));
    }
  }

  async deleteByAlbum(albumId: string): Promise<void> {
    const snap = await getDocs(
      query(collection(this.firestore, 'photos'), where('albumId', '==', albumId))
    );
    for (const d of snap.docs) {
      await this.deletePhoto({ id: d.id, ...d.data() } as Photo);
    }
  }
}
