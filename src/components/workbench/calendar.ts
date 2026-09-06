export interface CalendarDay {
  key: string;
  date: Date;
  day: number;
  inCurrentMonth: boolean;
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildCalendarGrid(month: Date): CalendarDay[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const firstCell = new Date(firstOfMonth);
  firstCell.setDate(firstCell.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return { key: dateKey(date), date, day: date.getDate(), inCurrentMonth: date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth() };
  });
}

export function shiftMonth(month: Date, amount: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + amount, 1);
}

export function monthTitle(month: Date): string {
  return `${month.getFullYear()}年${month.getMonth() + 1}月`;
}
