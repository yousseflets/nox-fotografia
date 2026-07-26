import { Component } from '@angular/core';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HeroComponent } from './sections/hero/hero.component';
import { AboutComponent } from './sections/about/about.component';
import { PortfolioComponent } from './sections/portfolio/portfolio.component';
import { FeaturesComponent } from './sections/features/features.component';
import { TestimonialsComponent } from './sections/testimonials/testimonials.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    NavbarComponent,
    FooterComponent,
    HeroComponent,
    AboutComponent,
    PortfolioComponent,
    FeaturesComponent,
    TestimonialsComponent,
  ],
  template: `
    <app-navbar />
    <main>
      <app-hero />
      <app-about />
      <app-portfolio />
      <app-features />
      <app-testimonials />
    </main>
    <app-footer />
  `,
})
export class HomeComponent {}
