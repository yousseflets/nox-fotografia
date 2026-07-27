import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  onSnapshot,
  setDoc,
} from '@angular/fire/firestore';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword as createSecondary } from 'firebase/auth';
import { Observable, filter, firstValueFrom, of, shareReplay, switchMap, take } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppUser, UserRole } from '../models/user.model';

function userDoc$(firestore: Firestore, uid: string): Observable<AppUser | null> {
  const ref = doc(firestore, `users/${uid}`);
  return new Observable<AppUser | null>((subscriber) => {
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          subscriber.next(null);
          return;
        }
        subscriber.next({ uid: snap.id, ...snap.data() } as AppUser);
      },
      (err) => subscriber.error(err)
    );
    return () => unsub();
  });
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);

  readonly firebaseUser$: Observable<User | null> = authState(this.auth);

  readonly user$: Observable<AppUser | null> = this.firebaseUser$.pipe(
    switchMap((user) => {
      if (!user) return of(null);
      return userDoc$(this.firestore, user.uid);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  login(email: string, password: string) {
    return signInWithEmailAndPassword(this.auth, email, password);
  }

  async register(name: string, email: string, password: string, role: UserRole = 'client') {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(credential.user, { displayName: name });
    await this.saveUserProfile(credential.user.uid, name, email, role);
    return credential;
  }

  /** Cria cliente sem deslogar o admin (app Auth secund√°rio). */
  async createClientAccount(name: string, email: string, password: string): Promise<string> {
    let secondaryApp: FirebaseApp | null = null;
    try {
      secondaryApp = initializeApp(environment.firebase, `secondary-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const credential = await createSecondary(secondaryAuth, email, password);
      await this.saveUserProfile(credential.user.uid, name, email, 'client');
      return credential.user.uid;
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
    }
  }

  private saveUserProfile(uid: string, name: string, email: string, role: UserRole) {
    const profile: AppUser = {
      uid,
      name,
      email,
      role,
      createdAt: new Date().toISOString(),
    };
    return setDoc(doc(this.firestore, `users/${uid}`), profile);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
    // Espera o Auth emitir null antes de navegar ó evita precisar clicar em Sair 2 vezes.
    await firstValueFrom(
      this.firebaseUser$.pipe(
        filter((user) => user === null),
        take(1)
      )
    );
  }
}
