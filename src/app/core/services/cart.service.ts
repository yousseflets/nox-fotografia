import { Injectable, computed, signal } from '@angular/core';
import { SaleOrderItem } from '../models/sale-order.model';

const STORAGE_KEY = 'nox-sale-cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly itemsSignal = signal<SaleOrderItem[]>(this.readStorage());

  readonly items = this.itemsSignal.asReadonly();
  readonly count = computed(() => this.itemsSignal().length);
  readonly totalCents = computed(() =>
    this.itemsSignal().reduce((sum, item) => sum + item.priceCents, 0)
  );

  add(item: SaleOrderItem) {
    const current = this.itemsSignal();
    if (current.some((i) => i.photoId === item.photoId)) return;
    this.write([...current, item]);
  }

  addMany(items: SaleOrderItem[]) {
    const map = new Map(this.itemsSignal().map((i) => [i.photoId, i]));
    for (const item of items) map.set(item.photoId, item);
    this.write([...map.values()]);
  }

  remove(photoId: string) {
    this.write(this.itemsSignal().filter((i) => i.photoId !== photoId));
  }

  clear() {
    this.write([]);
  }

  has(photoId: string) {
    return this.itemsSignal().some((i) => i.photoId === photoId);
  }

  private write(items: SaleOrderItem[]) {
    this.itemsSignal.set(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  private readStorage(): SaleOrderItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as SaleOrderItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
