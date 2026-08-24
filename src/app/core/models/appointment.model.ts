export type AppointmentStatus = 'pending' | 'confirmed' | 'done' | 'cancelled';

export interface Appointment {
  id?: string;
  clientName: string;
  phone: string;
  email?: string;
  /** Tipo do ensaio (ex.: gestante, casal, corporativo). */
  type: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time?: string;
  location?: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: string;
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  done: 'Conclu\u00eddo',
  cancelled: 'Cancelado',
};

export function formatAppointmentWhen(item: Pick<Appointment, 'date' | 'time'>): string {
  const [y, m, d] = (item.date || '').split('-');
  const dateLabel = y && m && d ? `${d}/${m}/${y}` : item.date || '';
  return item.time ? `${dateLabel} \u00b7 ${item.time}` : dateLabel;
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date | null {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDateLabel(key: string): string {
  const date = parseDateKey(key);
  if (!date) return key;
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export type CalendarDay = {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
};

export function buildCalendarWeeks(year: number, month: number): CalendarDay[][] {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const todayKey = formatDateKey(new Date());
  const weeks: CalendarDay[][] = [];

  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const cell = new Date(gridStart);
      cell.setDate(gridStart.getDate() + w * 7 + d);
      const key = formatDateKey(cell);
      week.push({
        key,
        day: cell.getDate(),
        inMonth: cell.getMonth() === month,
        isToday: key === todayKey,
        isPast: key < todayKey,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

export const CALENDAR_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'S\u00e1b'];

export const CALENDAR_MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Mar\u00e7o',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];
