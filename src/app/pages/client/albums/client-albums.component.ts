import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { switchMap, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AlbumService } from '../../../core/services/album.service';

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

  readonly albums$ = this.auth.user$.pipe(
    switchMap((user) => (user ? this.albums.getByClient(user.uid) : of([])))
  );
}
