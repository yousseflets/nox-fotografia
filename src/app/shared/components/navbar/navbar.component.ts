import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, AsyncPipe],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  menuOpen = false;
  scrolled = false;

  readonly links: { label: string; href: string; routerLink?: boolean }[] = [
    { label: 'In\u00edcio', href: '#inicio' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Portf\u00f3lio', href: '#portfolio' },
    { label: 'Depoimentos', href: '#depoimentos' },
    { label: 'Contato', href: '#contato' },
   // { label: 'Fotos \u00e0 Venda', href: '/fotos', routerLink: true },
  ];

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled = window.scrollY > 24;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu() {
    this.menuOpen = false;
  }
}
