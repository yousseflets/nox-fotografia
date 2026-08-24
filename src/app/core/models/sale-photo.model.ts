export interface SalePhoto {
  id?: string;
  eventId: string;
  /** Original privado (somente admin / Functions). */
  url: string;
  storagePath: string;
  /** Preview publico com marca d'agua. */
  previewUrl: string;
  previewStoragePath: string;
  thumbUrl?: string;
  thumbStoragePath?: string;
  filename: string;
  createdAt: string;
}

export function salePhotoPreview(photo: SalePhoto): string {
  // Sempre preferir preview com marca d'agua (thumb pode ser limpo em uploads antigos).
  return photo.previewUrl || photo.thumbUrl || '';
}
