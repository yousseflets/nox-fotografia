import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TestimonialService } from '../../../../core/services/testimonial.service';
import { Testimonial } from '../../../../core/models/testimonial.model';

const FALLBACK: Testimonial[] = [
  {
    name: 'Leticia Youssef',
    quote:
      'Muito obrigada por eternizar esse momento tão especial da nossa família com tanto carinho e sensibilidade. As fotos ficaram maravilhosas e serão uma lembrança para sempre dessa fase da Heloísa. Somos muito gratos pelo seu trabalho!',
    createdAt: '',
  },
  {
    name: 'Nicole Federici',
    quote:
      'Estou encantada com cada foto. Meu Deus como ele se divertiu no aniversário, olhando as fotos consegui perceber ainda mais.',
    createdAt: '',
  },
  {
    name: 'Emily Costa',
    quote:
      'Que trabalho maravilhoso, muito obrigada Nox, eu não me sentia tão bonita assim há muito tempo!',
    createdAt: '',
  },
];

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss',
})
export class TestimonialsComponent {
  private readonly testimonials = inject(TestimonialService);

  readonly index = signal(0);

  readonly items = toSignal(
    this.testimonials.getAll().pipe(
      map((list) => (list.length ? list : FALLBACK))
    ),
    { initialValue: FALLBACK }
  );

  prev() {
    const total = this.items().length;
    if (!total) return;
    this.index.update((i) => (i - 1 + total) % total);
  }

  next() {
    const total = this.items().length;
    if (!total) return;
    this.index.update((i) => (i + 1) % total);
  }

  visibleItems() {
    const list = this.items();
    const total = list.length;
    if (!total) return [];
    if (total <= 3) return list;
    const i = this.index();
    return [0, 1, 2].map((offset) => list[(i + offset) % total]);
  }
}
