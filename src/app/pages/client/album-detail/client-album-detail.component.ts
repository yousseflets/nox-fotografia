import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AlbumService } from '../../../core/services/album.service';
import { PhotoService } from '../../../core/services/photo.service';
import { Photo, photoThumbUrl } from '../../../core/models/photo.model';

@Component({
  selector: 'app-client-album-detail',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './client-album-detail.component.html',
  styleUrl: './client-album-detail.component.scss',
})
export class ClientAlbumDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly albums = inject(AlbumService);
  private readonly photos = inject(PhotoService);

  readonly albumId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly zipping = signal(false);
  readonly downloadingId = signal<string | null>(null);
  readonly loadedIds = signal<Record<string, boolean>>({});

  readonly album$ = this.albums.getById(this.albumId);
  readonly photos$ = this.photos.getByAlbum(this.albumId);

  readonly thumbUrl = photoThumbUrl;

  markLoaded(id: string | undefined) {
    if (!id) return;
    this.loadedIds.update((map) => ({ ...map, [id]: true }));
  }

  async downloadOne(photo: Photo, index = 0) {
    const id = photo.id ?? photo.storagePath ?? String(index);
    this.downloadingId.set(id);

    try {
      const bytes = await this.photos.getPhotoBytes(photo);
      const name = photo.filename || `foto-${index + 1}.jpg`;
      const blob = new Blob([bytes], { type: this.mimeFromName(name) });
      saveAs(blob, name);
    } catch (err) {
      console.error('[downloadOne]', err);
      alert('Não foi possível baixar esta foto. Tente novamente.');
    } finally {
      this.downloadingId.set(null);
    }
  }

  async downloadAll(photos: Photo[], albumTitle: string) {
    if (!photos.length) return;
    this.zipping.set(true);

    try {
      const zip = new JSZip();
      const folderName =
        (albumTitle || 'album').replace(/[^\w\- ]+/g, '').trim() || 'album';
      const folder = zip.folder(folderName);
      const usedNames = new Set<string>();

      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        const bytes = await this.photos.getPhotoBytes(photo);
        let name = photo.filename || `foto-${index + 1}.jpg`;
        if (usedNames.has(name)) {
          const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
          const baseName = ext ? name.slice(0, -ext.length) : name;
          name = `${baseName}-${index + 1}${ext}`;
        }
        usedNames.add(name);
        folder?.file(name, bytes, {
          binary: true,
          compression: 'STORE',
        });
      }

      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'STORE',
      });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      console.error('[downloadAll]', err);
      alert('Não foi possível gerar o ZIP. Tente baixar as fotos individualmente.');
    } finally {
      this.zipping.set(false);
    }
  }

  private mimeFromName(name: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.endsWith('.gif')) return 'image/gif';
    if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
    return 'image/jpeg';
  }
}
