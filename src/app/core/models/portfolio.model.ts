export type PortfolioIcon =
  | 'rings'
  | 'eye'
  | 'family'
  | 'maternity'
  | 'events'
  | 'portrait'
  | 'birthday';

export interface PortfolioCategory {
  id?: string;
  title: string;
  slug: string;
  icon: PortfolioIcon;
  coverUrl: string;
  coverStoragePath?: string;
  order: number;
  /** Se omitido (categorias antigas), conta como ativa. */
  active?: boolean;
  createdAt: string;
}

export interface PortfolioPhoto {
  id?: string;
  categoryId: string;
  categorySlug: string;
  url: string;
  alt: string;
  storagePath: string;
  createdAt: string;
}

export const DEFAULT_PORTFOLIO_CATEGORIES: Array<
  Pick<PortfolioCategory, 'title' | 'slug' | 'icon' | 'coverUrl' | 'order'>
> = [
  {
    title: 'Casamentos',
    slug: 'casamentos',
    icon: 'rings',
    coverUrl:
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=700&q=80',
    order: 1,
  },
  {
    title: 'Ensaios',
    slug: 'ensaios',
    icon: 'eye',
    coverUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=80',
    order: 2,
  },
  {
    title: 'Família',
    slug: 'familia',
    icon: 'family',
    coverUrl:
      'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=700&q=80',
    order: 3,
  },
  {
    title: 'Gestantes',
    slug: 'gestantes',
    icon: 'maternity',
    coverUrl:
      'https://images.unsplash.com/photo-1492725764893-90b379c2b6e7?auto=format&fit=crop&w=700&q=80',
    order: 4,
  },
  {
    title: 'Eventos',
    slug: 'eventos',
    icon: 'events',
    coverUrl:
      'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=700&q=80',
    order: 5,
  },
  {
    title: 'Retratos',
    slug: 'retratos',
    icon: 'portrait',
    coverUrl:
      'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=700&q=80',
    order: 6,
  },
];

export const PORTFOLIO_ICONS: PortfolioIcon[] = [
  'rings',
  'eye',
  'family',
  'maternity',
  'events',
  'portrait',
  'birthday',
];

export const PORTFOLIO_ICON_OPTIONS: Array<{ value: PortfolioIcon; label: string }> = [
  { value: 'rings', label: 'Alianças' },
  { value: 'eye', label: 'Olho' },
  { value: 'family', label: 'Família' },
  { value: 'maternity', label: 'Gestante' },
  { value: 'events', label: 'Eventos' },
  { value: 'portrait', label: 'Retrato' },
  { value: 'birthday', label: 'Aniversário' },
];

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Categorias antigas sem o campo contam como ativas. */
export function isCategoryActive(category: Pick<PortfolioCategory, 'active'> | { active?: boolean }): boolean {
  return category.active !== false;
}
