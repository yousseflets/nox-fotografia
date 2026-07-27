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
  orderBy,
  onSnapshot,
  QueryConstraint,
} from '@angular/fire/firestore';
import { Observable, catchError, firstValueFrom, map, of } from 'rxjs';
import { Album } from '../models/album.model';
import { AppUser } from '../models/user.model';
import { PhotoService } from './photo.service';

function collection$<T extends object>(
  firestore: Firestore,
  path: string,
  constraints: QueryConstraint[],
  idField: string
): Observable<T[]> {
  const q = query(collection(firestore, path), ...constraints);
  return new Observable<T[]>((subscriber) => {
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(
          (d) => ({ [idField]: d.id, ...d.data() }) as T
        );
        subscriber.next(items);
      },
      (err) => subscriber.error(err)
    );
    return () => unsub();
  });
}

function doc$<T extends object>(
  firestore: Firestore,
  path: string,
  idField = 'id'
): Observable<T | undefined> {
  const ref = doc(firestore, path);
  return new Observable<T | undefined>((subscriber) => {
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          subscriber.next(undefined);
          return;
        }
        subscriber.next({ [idField]: snap.id, ...snap.data() } as T);
      },
      (err) => subscriber.error(err)
    );
    return () => unsub();
  });
}

@Injectable({ providedIn: 'root' })
export class AlbumService {
  private readonly firestore = inject(Firestore);
  private readonly photos = inject(PhotoService);

  getAll(): Observable<Album[]> {
    return collection$<Album>(
      this.firestore,
      'albums',
      [orderBy('createdAt', 'desc')],
      'id'
    );
  }

  getByClient(clientId: string): Observable<Album[]> {
    // Sem orderBy no Firestore para não exigir índice composto (clientId + createdAt).
    return collection$<Album>(
      this.firestore,
      'albums',
      [where('clientId', '==', clientId)],
      'id'
    ).pipe(
      map((list) =>
        [...list].sort((a, b) =>
          (b.createdAt || '').localeCompare(a.createdAt || '')
        )
      ),
      catchError((err) => {
        console.error('[AlbumService.getByClient]', err);
        return of([]);
      })
    );
  }

  getById(albumId: string): Observable<Album | undefined> {
    return doc$<Album>(this.firestore, `albums/${albumId}`);
  }

  async create(album: Omit<Album, 'id'>): Promise<string> {
    const ref = await addDoc(collection(this.firestore, 'albums'), album);
    return ref.id;
  }

  update(albumId: string, data: Partial<Album>) {
    return updateDoc(doc(this.firestore, `albums/${albumId}`), data);
  }

  delete(albumId: string) {
    return deleteDoc(doc(this.firestore, `albums/${albumId}`));
  }

  async deleteAlbum(albumId: string): Promise<void> {
    await this.photos.deleteByAlbum(albumId);
    await this.delete(albumId);
  }
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly firestore = inject(Firestore);
  private readonly albums = inject(AlbumService);

  getClients(): Observable<AppUser[]> {
    // Sem orderBy no Firestore para não exigir índice composto (role + name).
    return collection$<AppUser>(
      this.firestore,
      'users',
      [where('role', '==', 'client')],
      'uid'
    ).pipe(
      map((list) =>
        [...list].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'pt-BR')
        )
      ),
      catchError((err) => {
        console.error('[UserService.getClients]', err);
        return of([]);
      })
    );
  }

  getUser(uid: string): Observable<AppUser | undefined> {
    return doc$<AppUser>(this.firestore, `users/${uid}`, 'uid');
  }

  updateClient(uid: string, data: Pick<AppUser, 'name' | 'email'>) {
    return updateDoc(doc(this.firestore, `users/${uid}`), {
      name: data.name,
      email: data.email,
    });
  }

  async deleteClient(uid: string): Promise<void> {
    const albums = await firstValueFrom(this.albums.getByClient(uid));
    for (const album of albums) {
      if (album.id) await this.albums.deleteAlbum(album.id);
    }
    await deleteDoc(doc(this.firestore, `users/${uid}`));
  }
}
