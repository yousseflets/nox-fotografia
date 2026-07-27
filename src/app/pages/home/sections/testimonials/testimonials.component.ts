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
      name: 'Leticia Youssef',
      quote:
        'Muito obrigada por eternizar esse momento tão especial da nossa família com tanto carinho e sensibilidade. As fotos ficaram maravilhosas e serão uma lembrança para sempre dessa fase da Heloísa. Somos muito gratos pelo seu trabalho! ✨💛',
    },
    {
      name: 'Nicole Federici',
      quote:
        'Estou encantada com cada foto. Meu Deus como ele se divertiu no aniversário, olhando as fotos consegui perceber ainda mais.',
    },
    {
      name: 'Emily Costa',
      quote:
        'Que trabalho maravilhoso, muito obrigada Nox, eu não me sentia tão bonita assim há muito tempo!',
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
