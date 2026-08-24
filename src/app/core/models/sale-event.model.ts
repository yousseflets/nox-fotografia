export interface SaleEvent {
  id?: string;
  title: string;
  slug: string;
  eventDate: string;
  description?: string;
  /** Preco unitario em centavos (ex.: 1500 = R$ 15,00). */
  priceCents: number;
  coverUrl?: string;
  active: boolean;
  createdAt: string;
}

export function formatPriceBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
