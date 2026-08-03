export interface GalleryImage {
  id?: string;
  url: string;
  alt: string;
  storagePath: string;
  /** Miniatura leve para o carrossel (fotos antigas podem não ter). */
  thumbUrl?: string;
  thumbStoragePath?: string;
  createdAt: string;
}

export function galleryDisplayUrl(image: Pick<GalleryImage, 'url' | 'thumbUrl'>): string {
  return image.thumbUrl || image.url;
}
