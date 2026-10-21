export type AlbumMode = 'delivery' | 'sale';

export interface Album {
  id?: string;
  title: string;
  clientId: string;
  clientName?: string;
  coverUrl?: string;
  createdAt: string;
  description?: string;
  /** Ausente nos álbuns antigos, que continuam sendo entrega completa. */
  mode?: AlbumMode;
  /** Preço por foto, em centavos, quando mode é sale. */
  priceCents?: number;
  /** Evento de venda usado no checkout. Não aparece em Fotos à Venda. */
  saleEventId?: string;
}

export function isSaleAlbum(album: Pick<Album, 'mode' | 'saleEventId'>): boolean {
  return album.mode === 'sale' && !!album.saleEventId;
}
