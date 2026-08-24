import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { FirebaseError } from 'firebase/app';
import { AppointmentService } from '../../../core/services/appointment.service';
import {
  Appointment,
  AppointmentStatus,
  APPOINTMENT_STATUS_LABELS,
  buildCalendarWeeks,
  CALENDAR_MONTHS,
  CALENDAR_WEEKDAYS,
  formatAppointmentWhen,
  formatDateKey,
  formatDateLabel,
} from '../../../core/models/appointment.model';

type StatusFilter = 'all' | AppointmentStatus;

@Component({
  selector: 'app-admin-agenda',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-agenda.component.html',
  styleUrl: './admin-agenda.component.scss',
})
export class AdminAgendaComponent {
  private readonly fb = inject(FormBuilder);
  private readonly appointments = inject(AppointmentService);

  private readonly listTick = signal(0);
  readonly listError = signal('');
  readonly list = toSignal(
    toObservable(this.listTick).pipe(
      switchMap(() =>
        this.appointments.getAll().pipe(
          tap(() => this.listError.set('')),
          catchError((err) => {
            console.error('[agenda.list]', err);
            this.listError.set(this.errorMessage(err, 'carregar'));
            return of([] as Appointment[]);
          })
        )
      )
    ),
    { initialValue: [] as Appointment[] }
  );

  readonly loading = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly modalOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly statusFilter = signal<StatusFilter>('all');

  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly selectedDate = signal<string | null>(null);

  readonly weekdays = CALENDAR_WEEKDAYS;
  readonly monthNames = CALENDAR_MONTHS;
  readonly todayKey = formatDateKey(new Date());
  readonly statusLabels = APPOINTMENT_STATUS_LABELS;
  readonly formatWhen = formatAppointmentWhen;
  readonly formatDateLabel = formatDateLabel;

  readonly filters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'pending', label: 'Pendente' },
    { id: 'confirmed', label: 'Confirmado' },
    { id: 'done', label: 'Conclu\u00eddo' },
    { id: 'cancelled', label: 'Cancelado' },
  ];

  readonly calendarWeeks = computed(() =>
    buildCalendarWeeks(this.viewYear(), this.viewMonth())
  );

  readonly monthLabel = computed(
    () => `${this.monthNames[this.viewMonth()]} ${this.viewYear()}`
  );

  readonly countsByDate = computed(() => {
    const map: Record<string, number> = {};
    for (const item of this.list()) {
      if (!item.date) continue;
      map[item.date] = (map[item.date] || 0) + 1;
    }
    return map;
  });

  readonly filtered = computed(() => {
    const filter = this.statusFilter();
    const selected = this.selectedDate();
    const year = this.viewYear();
    const month = this.viewMonth();

    let items = this.list();
    if (selected) {
      items = items.filter((item) => item.date === selected);
    } else {
      items = items.filter((item) => {
        if (!item.date) return false;
        const [y, m] = item.date.split('-').map(Number);
        return y === year && m === month + 1;
      });
    }
    if (filter !== 'all') {
      items = items.filter((item) => item.status === filter);
    }
    return items;
  });

  readonly listTitle = computed(() => {
    const selected = this.selectedDate();
    if (selected) return `Agendamentos \u00b7 ${formatDateLabel(selected)}`;
    return `Agendamentos \u00b7 ${this.monthLabel()}`;
  });

  readonly form = this.fb.nonNullable.group({
    clientName: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
    type: ['', Validators.required],
    date: ['', Validators.required],
    time: [''],
    location: [''],
    notes: [''],
    status: ['pending' as AppointmentStatus, Validators.required],
  });

  setFilter(filter: StatusFilter) {
    this.statusFilter.set(filter);
  }

  reloadList() {
    this.listError.set('');
    this.listTick.update((n) => n + 1);
  }

  prevMonth() {
    const m = this.viewMonth();
    const y = this.viewYear();
    if (m === 0) {
      this.viewMonth.set(11);
      this.viewYear.set(y - 1);
    } else {
      this.viewMonth.set(m - 1);
    }
  }

  nextMonth() {
    const m = this.viewMonth();
    const y = this.viewYear();
    if (m === 11) {
      this.viewMonth.set(0);
      this.viewYear.set(y + 1);
    } else {
      this.viewMonth.set(m + 1);
    }
  }

  goToday() {
    const today = new Date();
    this.viewYear.set(today.getFullYear());
    this.viewMonth.set(today.getMonth());
    this.selectedDate.set(formatDateKey(today));
  }

  selectDay(key: string, inMonth: boolean, isPast: boolean) {
    if (isPast) return;
    if (!inMonth) {
      const date = new Date(key + 'T12:00:00');
      this.viewYear.set(date.getFullYear());
      this.viewMonth.set(date.getMonth());
    }
    this.selectedDate.set(key);
    this.openModalForDate(key);
  }

  clearSelectedDay() {
    this.selectedDate.set(null);
  }

  openModalForDate(date: string) {
    this.editingId.set(null);
    this.error.set('');
    this.message.set('');
    this.form.reset({
      clientName: '',
      phone: '',
      email: '',
      type: '',
      date,
      time: '',
      location: '',
      notes: '',
      status: 'pending',
    });
    this.modalOpen.set(true);
  }

  startEdit(item: Appointment) {
    if (!item.id) return;
    this.editingId.set(item.id);
    this.error.set('');
    this.message.set('');
    this.selectedDate.set(item.date);
    this.form.setValue({
      clientName: item.clientName,
      phone: item.phone,
      email: item.email || '',
      type: item.type,
      date: item.date,
      time: item.time || '',
      location: item.location || '',
      notes: item.notes || '',
      status: item.status,
    });
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editingId.set(null);
    this.error.set('');
    this.form.reset({
      clientName: '',
      phone: '',
      email: '',
      type: '',
      date: '',
      time: '',
      location: '',
      notes: '',
      status: 'pending',
    });
  }

  async submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    const raw = this.form.getRawValue();
    const payload = {
      clientName: raw.clientName.trim(),
      phone: raw.phone.trim(),
      email: raw.email.trim(),
      type: raw.type.trim(),
      date: raw.date,
      time: raw.time.trim(),
      location: raw.location.trim(),
      notes: raw.notes.trim(),
      status: raw.status,
    };
    const id = this.editingId();

    try {
      if (id) {
        await this.appointments.update(id, payload);
        this.message.set('Agendamento atualizado.');
      } else {
        await this.appointments.create({
          ...payload,
          createdAt: new Date().toISOString(),
        });
        this.message.set('Agendamento cadastrado.');
      }
      this.closeModal();
      this.reloadList();
    } catch (err) {
      console.error('[agenda.submit]', err);
      this.error.set(this.errorMessage(err, id ? 'atualizar' : 'cadastrar'));
    } finally {
      this.loading.set(false);
    }
  }

  async setStatus(item: Appointment, status: AppointmentStatus) {
    if (!item.id) return;
    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      const { id: _id, createdAt: _createdAt, ...rest } = item;
      await this.appointments.update(item.id, { ...rest, status });
      this.message.set(
        status === 'confirmed'
          ? 'Agendamento confirmado.'
          : status === 'cancelled'
            ? 'Agendamento cancelado.'
            : 'Status atualizado.'
      );
      this.reloadList();
    } catch (err) {
      console.error('[agenda.setStatus]', err);
      this.error.set(this.errorMessage(err, 'atualizar'));
    } finally {
      this.loading.set(false);
    }
  }

  async removeEditing() {
    const id = this.editingId();
    if (!id) return;
    const item = this.list().find((a) => a.id === id);
    if (!item) return;
    await this.remove(item);
  }

  async remove(item: Appointment) {
    if (!item.id) return;
    const ok = confirm(`Excluir o agendamento de "${item.clientName}"?`);
    if (!ok) return;

    this.loading.set(true);
    this.error.set('');
    this.message.set('');

    try {
      await this.appointments.delete(item.id);
      if (this.editingId() === item.id) this.closeModal();
      this.message.set('Agendamento exclu\u00eddo.');
      this.reloadList();
    } catch (err) {
      console.error('[agenda.remove]', err);
      this.error.set(this.errorMessage(err, 'excluir'));
    } finally {
      this.loading.set(false);
    }
  }

  private errorMessage(err: unknown, action: string): string {
    if (err instanceof FirebaseError && err.code === 'permission-denied') {
      return (
        'Sem permiss\u00e3o no Firestore. Publique as rules com a cole\u00e7\u00e3o appointments ' +
        '(somente admin).'
      );
    }
    return `N\u00e3o foi poss\u00edvel ${action} o agendamento.`;
  }
}
