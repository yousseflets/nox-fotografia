import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Album } from '../models/album.model';
import { AppUser } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly firestore = inject(Firestore);

  getClients(): Observable<AppUser[]> {
    const q = query(
      collection(this.firestore, 'users'),
      where('role', '==', 'client'),
      orderBy('name')
    );
    return collectionData(q, { idField: 'uid' }) as Observable<AppUser[]>;
  }

  getUser(uid: string): Observable<AppUser | undefined> {
    return docData(doc(this.firestore, `users/${uid}`)) as Observable<AppUser | undefined>;
  }
}

@Injectable({ providedIn: 'root' })
export class AlbumService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<Album[]> {
    const q = query(collection(this.firestore, 'albums'), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<Album[]>;
  }

  getByClient(clientId: string): Observable<Album[]> {
    const q = query(
      collection(this.firestore, 'albums'),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Album[]>;
  }

  getById(albumId: string): Observable<Album | undefined> {
    return docData(doc(this.firestore, `albums/${albumId}`), { idField: 'id' }) as Observable<
      Album | undefined
    >;
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
