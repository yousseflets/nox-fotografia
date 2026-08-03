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
import { Photo, photoThumbUrl } from '../models/photo.model';
import { createImageThumbnail } from '../utils/image-thumbnail';

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
      map((list) => this.sortPhotos(list)),
      catchError((err) => {
        console.error('[PhotoService.getByAlbum]', err);
        return of([]);
      })
    );
  }

  /** Capa do álbum: miniatura da foto mais recente (ou url original). */
  async getAlbumCoverUrl(albumId: string): Promise<string | undefined> {
    const snap = await getDocs(
      query(collection(this.firestore, 'photos'), where('albumId', '==', albumId))
    );
    const items = this.sortPhotos(
      snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Photo)
    );
    const first = items[0];
    return first ? photoThumbUrl(first) : undefined;
  }

  private sortPhotos(list: Photo[]): Photo[] {
    return [...list].sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
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
    const stamp = Date.now();
    const baseDir = `clients/${clientId}/albums/${albumId}`;
    const storagePath = `${baseDir}/${stamp}_${safeName}`;
    const thumbStoragePath = `${baseDir}/${stamp}_${safeName.replace(/\.[^.]+$/, '')}_thumb.jpg`;

    let thumbUrl: string | undefined;
    try {
      const thumbBlob = await createImageThumbnail(file);
      onProgress?.(5);
      const thumb = await this.uploadBlob(thumbBlob, thumbStoragePath, (pct) =>
        onProgress?.(5 + pct * 0.15)
      );
      thumbUrl = thumb.url;
    } catch (err) {
      console.warn('[PhotoService] miniatura não gerada', err);
    }

    const original = await this.uploadBlob(file, storagePath, (pct) =>
      onProgress?.(20 + pct * 0.8)
    );

    const photo: Omit<Photo, 'id'> = {
      albumId,
      url: original.url,
      filename: file.name,
      storagePath,
      thumbUrl,
      thumbStoragePath: thumbUrl ? thumbStoragePath : undefined,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(this.firestore, 'photos'), photo);
    onProgress?.(100);
    return { id: docRef.id, ...photo };
  }

  async deletePhoto(photo: Photo): Promise<void> {
    for (const path of [photo.storagePath, photo.thumbStoragePath]) {
      if (!path) continue;
      try {
        await deleteObject(ref(this.storage, path));
      } catch {
        // arquivo pode já ter sido removido
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
        (snap) => {
          onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100);
        },
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
