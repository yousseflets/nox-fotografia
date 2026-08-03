import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { from, of, switchMap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AlbumService } from '../../../core/services/album.service';
import { PhotoService } from '../../../core/services/photo.service';
import { Album } from '../../../core/models/album.model';

@Component({
  selector: 'app-client-albums',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink],
  templateUrl: './client-albums.component.html',
  styleUrl: './client-albums.component.scss',
})
export class ClientAlbumsComponent {
  private readonly auth = inject(AuthService);
  private readonly albums = inject(AlbumService);
  private readonly photos = inject(PhotoService);

  readonly albums$ = this.auth.user$.pipe(
    switchMap((user) => (user ? this.albums.getByClient(user.uid) : of([] as Album[]))),
    switchMap((albums) => from(this.withCovers(albums)))
  );

  private async withCovers(albums: Album[]): Promise<Album[]> {
    return Promise.all(
      albums.map(async (album) => {
        if (album.coverUrl || !album.id) return album;
        const coverUrl = await this.photos.getAlbumCoverUrl(album.id);
        if (!coverUrl) return album;
        try {
          await this.albums.update(album.id, { coverUrl });
        } catch {
          // lista ainda mostra a capa mesmo se persistir falhar
        }
        return { ...album, coverUrl };
      })
    );
  }
}
