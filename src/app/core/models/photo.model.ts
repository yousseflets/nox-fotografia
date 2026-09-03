export interface Photo {
  id?: string;
  albumId: string;
  url: string;
  filename: string;
  storagePath: string;
  /** Miniatura para grades (opcional em fotos antigas). */
  thumbUrl?: string;
  thumbStoragePath?: string;
  /** Versão intermediária para o visualizador (opcional em fotos antigas). */
  previewUrl?: string;
  previewStoragePath?: string;
  createdAt: string;
}

export function photoThumbUrl(photo: Pick<Photo, 'url' | 'thumbUrl'>): string {
  return photo.thumbUrl || photo.url;
}

export function photoDisplayUrl(
  photo: Pick<Photo, 'url' | 'previewUrl' | 'thumbUrl'>
): string {
  return photo.previewUrl || photo.url;
}
