export interface Photo {
  id?: string;
  albumId: string;
  url: string;
  filename: string;
  storagePath: string;
  /** Miniatura para grades (opcional em fotos antigas). */
  thumbUrl?: string;
  thumbStoragePath?: string;
  createdAt: string;
}

export function photoThumbUrl(photo: Pick<Photo, 'url' | 'thumbUrl'>): string {
  return photo.thumbUrl || photo.url;
}
