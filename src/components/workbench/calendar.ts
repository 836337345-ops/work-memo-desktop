export interface CalendarDay {
  key: string;
  date: Date;
  day: number;
  inCurrentMonth: boolean;
}

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export const HOLIDAY_NAMES = ['元旦', '春节', '清明', '劳动节', '母亲节', '端午', '中秋', '国庆'] as const;

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

let chineseCalendarFormatter: Intl.DateTimeFormat | null = null;

function lunarParts(date: Date): { month: number; day: number; year: number } | null {
  try {
    chineseCalendarFormatter ??= new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = chineseCalendarFormatter.formatToParts(date);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    const year = Number(parts.find((part) => part.type === 'year' || (part.type as string) === 'relatedYear')?.value);
    return Number.isFinite(month) && Number.isFinite(day) && Number.isFinite(year) ? { month, day, year } : null;
  } catch {
    return null;
  }
}

function findLunarDate(year: number, lunarMonth: number, lunarDay: number, startMonth: number, endMonth: number): Date | null {
  const cursor = new Date(year, startMonth, 1);
  const end = new Date(year, endMonth + 1, 0);
  while (cursor <= end) {
    const parts = lunarParts(cursor);
    if (parts?.year === year && parts.month === lunarMonth && parts.day === lunarDay) return new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

function secondSundayOfMay(year: number): Date {
  const first = new Date(year, 4, 1);
  const offset = (7 - first.getDay()) % 7;
  return new Date(year, 4, 1 + offset + 7);
}

function qingmingDate(year: number): Date {
  const centuryYear = year % 100;
  const day = Math.floor(centuryYear * 0.2422 + 4.81) - Math.floor(centuryYear / 4);
  return new Date(year, 3, Math.max(4, Math.min(5, day)));
}

export function holidaysForYear(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const add = (date: Date | null, name: string) => { if (date) { const key = dateKey(date); holidays.set(key, holidays.has(key) ? `${holidays.get(key)}/${name}` : name); } };
  add(new Date(year, 0, 1), '元旦');
  add(findLunarDate(year, 1, 1, 0, 2), '春节');
  add(qingmingDate(year), '清明');
  add(new Date(year, 4, 1), '劳动节');
  add(secondSundayOfMay(year), '母亲节');
  add(findLunarDate(year, 5, 5, 4, 6), '端午');
  add(findLunarDate(year, 8, 15, 8, 10), '中秋');
  add(new Date(year, 9, 1), '国庆');
  return holidays;
}
