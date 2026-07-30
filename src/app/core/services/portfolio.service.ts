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
  where,
} from '@angular/fire/firestore';
import {
  Storage,
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from '@angular/fire/storage';
import { Observable, catchError, from, map, of, shareReplay } from 'rxjs';
import {
  DEFAULT_PORTFOLIO_CATEGORIES,
  PortfolioCategory,
  PortfolioIcon,
  PortfolioPhoto,
  slugify,
} from '../models/portfolio.model';

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);

  private readonly categories$ = new Observable<PortfolioCategory[]>((subscriber) => {
    const q = query(collection(this.firestore, 'portfolioCategories'), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        subscriber.next(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PortfolioCategory)
        );
      },
      (err) => subscriber.error(err)
    );
    return () => unsub();
  }).pipe(
    catchError((err) => {
      console.error('[PortfolioService.getCategories]', err);
      return of([] as PortfolioCategory[]);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  getCategories(): Observable<PortfolioCategory[]> {
    return this.categories$;
  }

  /** Busca pontual por slug (mais rápida que listar todas as categorias). */
  getCategoryBySlug(slug: string): Observable<PortfolioCategory | undefined> {
    const q = query(
      collection(this.firestore, 'portfolioCategories'),
      where('slug', '==', slug)
    );
    return from(getDocs(q)).pipe(
      map((snap) => {
        const d = snap.docs[0];
        return d ? ({ id: d.id, ...d.data() } as PortfolioCategory) : undefined;
      }),
      catchError((err) => {
        console.error('[PortfolioService.getCategoryBySlug]', err);
        return of(undefined);
      })
    );
  }

  /** Fotos por slug — permite carregar em paralelo com a categoria. */
  getPhotosBySlug(slug: string): Observable<PortfolioPhoto[]> {
    const q = query(
      collection(this.firestore, 'portfolioPhotos'),
      where('categorySlug', '==', slug)
    );
    return from(getDocs(q)).pipe(
      map((snap) => this.sortPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PortfolioPhoto))),
      catchError((err) => {
        console.error('[PortfolioService.getPhotosBySlug]', err);
        return of([] as PortfolioPhoto[]);
      })
    );
  }

  async createCategory(data: {
    title: string;
    icon: PortfolioIcon;
    coverFile?: File | null;
    order?: number;
    active?: boolean;
  }): Promise<string> {
    const slug = slugify(data.title);
    let coverUrl =
      DEFAULT_PORTFOLIO_CATEGORIES.find((c) => c.slug === slug)?.coverUrl ||
      DEFAULT_PORTFOLIO_CATEGORIES[0].coverUrl;
    let coverStoragePath: string | undefined;

    if (data.coverFile) {
      const uploaded = await this.uploadFile(
        data.coverFile,
        `portfolio/covers/${Date.now()}_${this.safeName(data.coverFile.name)}`
      );
      coverUrl = uploaded.url;
      coverStoragePath = uploaded.storagePath;
    }

    const payload: Omit<PortfolioCategory, 'id'> = {
      title: data.title.trim(),
      slug,
      icon: data.icon,
      coverUrl,
      coverStoragePath,
      order: data.order ?? Date.now(),
      active: data.active !== false,
      createdAt: new Date().toISOString(),
    };

    const refDoc = await addDoc(collection(this.firestore, 'portfolioCategories'), payload);
    return refDoc.id;
  }

  async updateCategory(
    id: string,
    data: {
      title: string;
      icon: PortfolioIcon;
      coverFile?: File | null;
      active?: boolean;
    }
  ): Promise<void> {
    const patch: Partial<PortfolioCategory> = {
      title: data.title.trim(),
      slug: slugify(data.title),
      icon: data.icon,
    };

    if (data.active !== undefined) {
      patch.active = data.active;
    }

    if (data.coverFile) {
      const uploaded = await this.uploadFile(
        data.coverFile,
        `portfolio/covers/${Date.now()}_${this.safeName(data.coverFile.name)}`
      );
      patch.coverUrl = uploaded.url;
      patch.coverStoragePath = uploaded.storagePath;
    }

    await updateDoc(doc(this.firestore, `portfolioCategories/${id}`), patch);
  }

  async setCategoryActive(id: string, active: boolean): Promise<void> {
    await updateDoc(doc(this.firestore, `portfolioCategories/${id}`), { active });
  }

  async deleteCategory(category: PortfolioCategory): Promise<void> {
    if (!category.id) return;
    const photos = await this.getPhotosOnce(category.id);
    for (const photo of photos) {
      await this.deletePhoto(photo);
    }
    if (category.coverStoragePath) {
      try {
        await deleteObject(ref(this.storage, category.coverStoragePath));
      } catch {
        // ignore
      }
    }
    await deleteDoc(doc(this.firestore, `portfolioCategories/${category.id}`));
  }

  async seedDefaultCategories(): Promise<number> {
    const existing = await getDocs(collection(this.firestore, 'portfolioCategories'));
    const existingSlugs = new Set(
      existing.docs.map((d) => (d.data() as PortfolioCategory).slug)
    );
    let created = 0;
    for (const item of DEFAULT_PORTFOLIO_CATEGORIES) {
      if (existingSlugs.has(item.slug)) continue;
      await addDoc(collection(this.firestore, 'portfolioCategories'), {
        ...item,
        active: true,
        createdAt: new Date().toISOString(),
      } satisfies Omit<PortfolioCategory, 'id'>);
      created += 1;
    }
    return created;
  }

  getPhotosByCategory(categoryId: string): Observable<PortfolioPhoto[]> {
    const q = query(
      collection(this.firestore, 'portfolioPhotos'),
      where('categoryId', '==', categoryId)
    );

    return new Observable<PortfolioPhoto[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          subscriber.next(
            this.sortPhotos(
              snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PortfolioPhoto)
            )
          );
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    }).pipe(
      catchError((err) => {
        console.error('[PortfolioService.getPhotosByCategory]', err);
        return of([]);
      })
    );
  }

  /** Uma leitura pontual por categoryId (fallback / admin pontual). */
  getPhotosByCategoryOnce(categoryId: string): Observable<PortfolioPhoto[]> {
    return from(this.getPhotosOnce(categoryId)).pipe(
      map((items) => this.sortPhotos(items)),
      catchError((err) => {
        console.error('[PortfolioService.getPhotosByCategoryOnce]', err);
        return of([] as PortfolioPhoto[]);
      })
    );
  }

  async uploadPhoto(
    file: File,
    category: PortfolioCategory,
    alt = '',
    onProgress?: (pct: number) => void
  ): Promise<string> {
    if (!category.id) throw new Error('Categoria sem id');
    const storagePath = `portfolio/${category.id}/${Date.now()}_${this.safeName(file.name)}`;
    const uploaded = await this.uploadFile(file, storagePath, onProgress);
    const payload: Omit<PortfolioPhoto, 'id'> = {
      categoryId: category.id,
      categorySlug: category.slug,
      url: uploaded.url,
      alt: alt.trim() || category.title,
      storagePath: uploaded.storagePath,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(this.firestore, 'portfolioPhotos'), payload);
    return docRef.id;
  }

  async deletePhoto(photo: PortfolioPhoto): Promise<void> {
    if (photo.storagePath) {
      try {
        await deleteObject(ref(this.storage, photo.storagePath));
      } catch {
        // ignore
      }
    }
    if (photo.id) {
      await deleteDoc(doc(this.firestore, `portfolioPhotos/${photo.id}`));
    }
  }

  private sortPhotos(items: PortfolioPhoto[]): PortfolioPhoto[] {
    return [...items].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  private async getPhotosOnce(categoryId: string): Promise<PortfolioPhoto[]> {
    const snap = await getDocs(
      query(collection(this.firestore, 'portfolioPhotos'), where('categoryId', '==', categoryId))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PortfolioPhoto);
  }

  private safeName(name: string) {
    return name.replace(/[^\w.\-]+/g, '_');
  }

  private async uploadFile(
    file: File,
    storagePath: string,
    onProgress?: (pct: number) => void
  ): Promise<{ url: string; storagePath: string }> {
    const storageRef = ref(this.storage, storagePath);
    const task = uploadBytesResumable(storageRef, file);
    await new Promise<void>((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => onProgress?.((snap.bytesTransferred / snap.totalBytes) * 100),
        reject,
        () => resolve()
      );
    });
    const url = await getDownloadURL(storageRef);
    return { url, storagePath };
  }
}
