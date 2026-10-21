import { Component, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { SaleService } from '../../../core/services/sale.service';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';

@Component({
  selector: 'app-sales-events-list',
  standalone: true,
  imports: [AsyncPipe, DatePipe, RouterLink, NavbarComponent, FooterComponent],
  templateUrl: './sales-events-list.component.html',
  styleUrl: './sales-events-list.component.scss',
})
export class SalesEventsListComponent {
  private readonly sales = inject(SaleService);
  readonly events$ = this.sales.getEvents(true).pipe(
    map((events) => events.filter((event) => event.audience !== 'client'))
  );
}
