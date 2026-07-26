import { Component } from '@angular/core';

@Component({
  selector: 'app-features',
  standalone: true,
  templateUrl: './features.component.html',
  styleUrl: './features.component.scss',
})
export class FeaturesComponent {
  readonly items = [
    {
      title: 'Atendimento personalizado',
      text: 'Cada projeto recebe atenção exclusiva, do briefing à entrega final.',
      icon: 'person',
    },
    {
      title: 'Edição profissional',
      text: 'Tratamento cuidadoso de cor e luz para valorizar cada imagem.',
      icon: 'moon',
    },
    {
      title: 'Qualidade premium',
      text: 'Equipamento profissional e direção estética refinada em cada ensaio.',
      icon: 'diamond',
    },
    {
      title: 'Memórias para toda vida',
      text: 'Álbuns digitais organizados para reviver seus momentos com facilidade.',
      icon: 'heart',
    },
  ];
}
