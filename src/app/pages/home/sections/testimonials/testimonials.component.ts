import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-testimonials',
  standalone: true,
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
})
export class TestimonialsComponent {
  readonly index = signal(0);

  readonly items = [
    {
      quote:
        'A NOX capturou nosso casamento com uma sensibilidade incrível. Cada foto parece um filme.',
      name: 'Juliana e Caio',
      photo:
        'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=200&q=80',
    },
    {
      quote:
        'Do agendamento à entrega, o atendimento foi impecável. As fotos do ensaio ficaram mágicas.',
      name: 'Gabriela Lima',
      photo:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
    },
    {
      quote:
        'As imagens do meu ensaio corporativo transmitiram exatamente a presença que eu queria.',
      name: 'Rafael Almeida',
      photo:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    },
  ];

  prev() {
    const total = this.items.length;
    this.index.update((i) => (i - 1 + total) % total);
  }

  next() {
    const total = this.items.length;
    this.index.update((i) => (i + 1) % total);
  }

  visibleItems() {
    const i = this.index();
    const total = this.items.length;
    return [0, 1, 2].map((offset) => this.items[(i + offset) % total]);
  }
}
