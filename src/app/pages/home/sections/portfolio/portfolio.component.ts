import { Component } from '@angular/core';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss',
})
export class PortfolioComponent {
  readonly items = [
    {
      title: 'Casamentos',
      image:
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=700&q=80',
      icon: 'rings',
    },
    {
      title: 'Ensaios',
      image:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=700&q=80',
      icon: 'eye',
    },
    {
      title: 'Família',
      image:
        'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=700&q=80',
      icon: 'family',
    },
    {
      title: 'Gestantes',
      image:
        'https://images.unsplash.com/photo-1492725764893-90b379c2b6e7?auto=format&fit=crop&w=700&q=80',
      icon: 'maternity',
    },
    {
      title: 'Eventos',
      image:
        'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=700&q=80',
      icon: 'events',
    },
    {
      title: 'Retratos',
      image:
        'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=700&q=80',
      icon: 'portrait',
    },
  ];
}
