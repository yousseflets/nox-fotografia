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
  updateDoc,
} from '@angular/fire/firestore';
import { Observable, catchError, of } from 'rxjs';
import { Testimonial } from '../models/testimonial.model';

@Injectable({ providedIn: 'root' })
export class TestimonialService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<Testimonial[]> {
    const q = query(
      collection(this.firestore, 'testimonials'),
      orderBy('createdAt', 'desc')
    );

    return new Observable<Testimonial[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          subscriber.next(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Testimonial)
          );
        },
        (err) => subscriber.error(err)
      );
      return () => unsub();
    }).pipe(
      catchError((err) => {
        console.error('[TestimonialService.getAll]', err);
        return of([]);
      })
    );
  }

  async create(data: Omit<Testimonial, 'id'>): Promise<string> {
    const ref = await addDoc(collection(this.firestore, 'testimonials'), data);
    return ref.id;
  }

  update(id: string, data: Pick<Testimonial, 'name' | 'quote'>) {
    return updateDoc(doc(this.firestore, `testimonials/${id}`), data);
  }

  delete(id: string) {
    return deleteDoc(doc(this.firestore, `testimonials/${id}`));
  }
}
