import { Component, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AlbumService, UserService } from '../../../core/services/album.service';
import { map } from 'rxjs';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [AsyncPipe, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly albums = inject(AlbumService);
  private readonly users = inject(UserService);

  readonly clientCount$ = this.users.getClients().pipe(map((list) => list.length));
  readonly albumCount$ = this.albums.getAll().pipe(map((list) => list.length));
  readonly recentAlbums$ = this.albums.getAll().pipe(map((list) => list.slice(0, 5)));
}
