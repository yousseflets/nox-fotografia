import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly year = new Date().getFullYear();

  readonly contacts = [
    { label: 'Instagram', value: '@nox.fotografia', href: 'https://instagram.com' },
    { label: 'WhatsApp', value: '(11) 98927-3898', href: 'https://wa.me/5511989273898' },
    { label: 'E-mail', value: 'thaisroza@gmail.com', href: 'mailto:thaisroza@gmail.com' },
    { label: 'Localização', value: 'Mogi das Cruzes - SP', href: '#' },
  ];
}
