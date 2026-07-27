import { Component, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { AlbumService } from '../../../core/services/album.service';
import { PhotoService } from '../../../core/services/photo.service';
import { Photo } from '../../../core/models/photo.model';

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

  readonly album$ = this.albums.getById(this.albumId);
  readonly photos$ = this.photos.getByAlbum(this.albumId);

  async downloadAll(photos: Photo[], albumTitle: string) {
    if (!photos.length) return;
    this.zipping.set(true);

    try {
      const zip = new JSZip();
      const folderName = (albumTitle || 'album')
        .replace(/[^\w\- ]+/g, '')
        .trim() || 'album';
      const folder = zip.folder(folderName);
      const usedNames = new Set<string>();

      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index];
        const blob = await this.photos.getPhotoBlob(photo);
        let name = photo.filename || `foto-${index + 1}.jpg`;
        if (usedNames.has(name)) {
          const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
          const base = ext ? name.slice(0, -ext.length) : name;
          name = `${base}-${index + 1}${ext}`;
        }
        usedNames.add(name);
        folder?.file(name, blob);
      }

      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      saveAs(content, `${folderName}.zip`);
    } catch (err) {
      console.error('[downloadAll]', err);
      alert('Não foi possível gerar o ZIP. Tente baixar as fotos individualmente.');
    } finally {
      this.zipping.set(false);
    }
  }
}
