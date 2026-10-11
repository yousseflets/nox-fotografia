export type MediaKind = 'image' | 'video';

const VIDEO_NAME = /\.(mp4|m4v|mov|webm|avi|mkv)(\?|#|$)/i;

export interface Photo {
  id?: string;
  albumId: string;
  url: string;
  filename: string;
  storagePath: string;
  /** Ausente em fotos antigas, que continuam sendo tratadas como imagem. */
  kind?: MediaKind;
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

export function isVideoPhoto(photo: Pick<Photo, 'kind' | 'filename'>): boolean {
  if (photo.kind === 'video') return true;
  if (photo.kind === 'image') return false;
  return VIDEO_NAME.test(photo.filename || '');
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || VIDEO_NAME.test(file.name);
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif|bmp|tiff?)(\?|#|$)/i.test(file.name);
}
