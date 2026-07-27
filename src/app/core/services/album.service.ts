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
import { Observable } from 'rxjs';
import { Album } from '../models/album.model';
import { AppUser } from '../models/user.model';

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
export class UserService {
  private readonly firestore = inject(Firestore);

  getClients(): Observable<AppUser[]> {
    return collection$<AppUser>(
      this.firestore,
      'users',
      [where('role', '==', 'client'), orderBy('name')],
      'uid'
    );
  }

  getUser(uid: string): Observable<AppUser | undefined> {
    return doc$<AppUser>(this.firestore, `users/${uid}`, 'uid');
  }
}

@Injectable({ providedIn: 'root' })
export class AlbumService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<Album[]> {
    return collection$<Album>(
      this.firestore,
      'albums',
      [orderBy('createdAt', 'desc')],
      'id'
    );
  }

  getByClient(clientId: string): Observable<Album[]> {
    return collection$<Album>(
      this.firestore,
      'albums',
      [where('clientId', '==', clientId), orderBy('createdAt', 'desc')],
      'id'
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
}
