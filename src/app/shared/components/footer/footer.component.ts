import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly contacts = [
    {
      label: 'Instagram',
      value: '@nox.fotografia',
      href: 'https://www.instagram.com/nox.fotografia_?igsh=MW8zd3A5cnA5b2l5dQ==',
    },
    { label: 'WhatsApp', value: '(11) 98927-3898', href: 'https://wa.me/5511989273898' },
    { label: 'E-mail', value: 'thataroza@gmail.com', href: 'mailto:thataroza@gmail.com' },
    { label: 'Localiza\u00e7\u00e3o', value: 'Mogi das Cruzes - SP', href: '#' },
  ];
}
