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
import { isVideoFile, isVideoPhoto, Photo, photoThumbUrl } from '../models/photo.model';
import { createImageThumbnail } from '../utils/image-thumbnail';
import { createVideoPosters } from '../utils/video-poster';

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
    const cover = items.find((item) => (isVideoPhoto(item) ? !!item.thumbUrl : !!photoThumbUrl(item)));
    if (!cover) return undefined;
    return isVideoPhoto(cover) ? cover.thumbUrl : photoThumbUrl(cover);
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
    const stem = safeName.replace(/\.[^.]+$/, '');
    const thumbStoragePath = `${baseDir}/${stamp}_${stem}_thumb.jpg`;
    const previewStoragePath = `${baseDir}/${stamp}_${stem}_preview.jpg`;
    const video = isVideoFile(file);

    let thumbUrl: string | undefined;
    let previewUrl: string | undefined;
    if (video) {
      try {
        const posters = await createVideoPosters(file);
        onProgress?.(4);
        const thumb = await this.uploadBlob(posters.thumb, thumbStoragePath, (pct) =>
          onProgress?.(4 + pct * 0.08)
        );
        thumbUrl = thumb.url;
        onProgress?.(14);
        const preview = await this.uploadBlob(posters.preview, previewStoragePath, (pct) =>
          onProgress?.(14 + pct * 0.16)
        );
        previewUrl = preview.url;
      } catch (err) {
        console.warn('[PhotoService] capa do vídeo não gerada', err);
      }
    } else {
      try {
        const thumbBlob = await createImageThumbnail(file, 480, 0.72);
        onProgress?.(4);
        const thumb = await this.uploadBlob(thumbBlob, thumbStoragePath, (pct) =>
          onProgress?.(4 + pct * 0.08)
        );
        thumbUrl = thumb.url;
      } catch (err) {
        console.warn('[PhotoService] miniatura não gerada', err);
      }

      try {
        const previewBlob = await createImageThumbnail(file, 1600, 0.8);
        onProgress?.(14);
        const preview = await this.uploadBlob(previewBlob, previewStoragePath, (pct) =>
          onProgress?.(14 + pct * 0.16)
        );
        previewUrl = preview.url;
      } catch (err) {
        console.warn('[PhotoService] preview não gerada', err);
      }
    }

    const original = await this.uploadBlob(
      file,
      storagePath,
      (pct) => onProgress?.(30 + pct * 0.7),
      contentTypeFor(file)
    );

    const photo: Omit<Photo, 'id'> = {
      albumId,
      url: original.url,
      filename: file.name,
      storagePath,
      kind: video ? 'video' : 'image',
      thumbUrl,
      thumbStoragePath: thumbUrl ? thumbStoragePath : undefined,
      previewUrl,
      previewStoragePath: previewUrl ? previewStoragePath : undefined,
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(this.firestore, 'photos'), photo);
    onProgress?.(100);
    return { id: docRef.id, ...photo };
  }

  async deletePhoto(photo: Photo): Promise<void> {
    for (const path of [photo.storagePath, photo.thumbStoragePath, photo.previewStoragePath]) {
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
    onProgress?: (pct: number) => void,
    contentType?: string
  ): Promise<{ url: string; storagePath: string }> {
    const storageRef = ref(this.storage, storagePath);
    const type = contentType || data.type;
    const task = uploadBytesResumable(storageRef, data, type ? { contentType: type } : undefined);

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

function contentTypeFor(file: File): string | undefined {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.mp4') || name.endsWith('.m4v')) return 'video/mp4';
  if (name.endsWith('.mov')) return 'video/quicktime';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.avi')) return 'video/x-msvideo';
  if (name.endsWith('.mkv')) return 'video/x-matroska';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return undefined;
}
