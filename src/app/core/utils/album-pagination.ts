/** Fotos por página nos álbuns (admin e cliente). */
export const ALBUM_PHOTOS_PAGE_SIZE = 16;

export function paginateItems<T>(items: T[], page: number, pageSize = ALBUM_PHOTOS_PAGE_SIZE): T[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(totalItems: number, pageSize = ALBUM_PHOTOS_PAGE_SIZE): number {
  if (totalItems <= 0) return 0;
  return Math.ceil(totalItems / pageSize);
}
