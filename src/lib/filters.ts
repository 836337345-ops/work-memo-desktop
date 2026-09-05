import type { ItemStatus, WorkItem } from '../types';

export type DateFilter = 'all' | 'today' | 'thisWeek' | 'nextWeek' | 'thisMonth' | 'nextMonth' | 'overdue' | 'noDate' | 'custom';

export interface FilterOptions {
  dateFilter: DateFilter;
  categoryId?: string | null;
  status?: ItemStatus | 'all';
  customStart?: string;
  customEnd?: string;
  query?: string;
  today?: string;
}

const pad = (value: number) => String(value).padStart(2, '0');
export const formatLocalDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function localDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = localDate(value);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function inRange(date: string | null, start: string, end: string) {
  return date !== null && date >= start && date <= end;
}

export function matchesDateFilter(item: WorkItem, filter: DateFilter, today = formatLocalDate(new Date()), customStart?: string, customEnd?: string) {
  const dueDate = item.dueDate;
  const weekday = localDate(today).getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = addDays(today, mondayOffset);

  switch (filter) {
    case 'all': return true;
    case 'today': return dueDate === today;
    case 'thisWeek': return inRange(dueDate, weekStart, addDays(weekStart, 6));
    case 'nextWeek': {
      const nextStart = addDays(weekStart, 7);
      return inRange(dueDate, nextStart, addDays(nextStart, 6));
    }
    case 'thisMonth': return dueDate !== null && dueDate.slice(0, 7) === today.slice(0, 7);
    case 'nextMonth': {
      const date = localDate(today);
      const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return dueDate !== null && dueDate.slice(0, 7) === formatLocalDate(nextMonth).slice(0, 7);
    }
    case 'overdue': return dueDate !== null && dueDate < today && (item.status === 'todo' || item.status === 'doing');
    case 'noDate': return dueDate === null;
    case 'custom': return dueDate !== null && (!customStart || dueDate >= customStart) && (!customEnd || dueDate <= customEnd);
  }
}

export function isOverdue(item: WorkItem, today = formatLocalDate(new Date())) {
  return item.dueDate !== null && item.dueDate < today && (item.status === 'todo' || item.status === 'doing');
}

export function searchItems(items: WorkItem[], query = '') {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return items;
  return items.filter((item) => [
    item.title, item.content, item.notes, item.progress[0]?.content ?? '', ...item.followUps.map((followUp) => followUp.text),
  ].some((value) => value.toLocaleLowerCase().includes(term)));
}

export function sortByDueDate(items: WorkItem[]) {
  return [...items].sort((left, right) => {
    if (left.dueDate === null && right.dueDate !== null) return 1;
    if (left.dueDate !== null && right.dueDate === null) return -1;
    if (left.dueDate !== right.dueDate) return (left.dueDate ?? '').localeCompare(right.dueDate ?? '');
    return right.createdAt.localeCompare(left.createdAt);
  });
}

export function filterItems(items: WorkItem[], options: FilterOptions) {
  return sortByDueDate(searchItems(items, options.query).filter((item) =>
    (options.categoryId === undefined || item.categoryId === options.categoryId)
    && (!options.status || options.status === 'all' || item.status === options.status)
    && matchesDateFilter(item, options.dateFilter, options.today, options.customStart, options.customEnd),
  ));
}
