import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { Appointment } from '../models/appointment.model';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<Appointment[]> {
    const q = query(collection(this.firestore, 'appointments'));

    return new Observable<Appointment[]>((subscriber) => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);
          items.sort((a, b) => {
            const byDate = (b.date || '').localeCompare(a.date || '');
            if (byDate !== 0) return byDate;
            return (b.time || '').localeCompare(a.time || '');
          });
          subscriber.next(items);
        },
        (err) => {
          console.error('[AppointmentService.getAll]', err);
          subscriber.error(err);
        }
      );
      return () => unsub();
    });
  }

  async create(data: Omit<Appointment, 'id'>): Promise<string> {
    const ref = await addDoc(collection(this.firestore, 'appointments'), data);
    return ref.id;
  }

  update(id: string, data: Omit<Appointment, 'id' | 'createdAt'>): Promise<void> {
    return updateDoc(doc(this.firestore, `appointments/${id}`), { ...data });
  }

  delete(id: string): Promise<void> {
    return deleteDoc(doc(this.firestore, `appointments/${id}`));
  }
}
