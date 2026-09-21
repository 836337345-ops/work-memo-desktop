import { useMemo, useState } from 'react';
import { type Category, type WorkItem } from '../../types';
import { sortByDueDate } from '../../lib/filters';
import { buildCalendarGrid, dateKey, holidaysForYear, monthTitle, shiftMonth, WEEKDAY_LABELS } from './calendar';
import './calendar.css';

interface WorkCalendarProps { items: WorkItem[]; categories?: Category[]; onClose: () => void; onOpenItem?: (id: string) => void; onNewItem?: (date: string) => void; }

function localTodayKey(): string { return dateKey(new Date()); }

export function WorkCalendar({ items, categories = [], onClose, onOpenItem, onNewItem }: WorkCalendarProps) {
  const [month, setMonth] = useState(() => new Date());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Array<string | null>>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<WorkItem['status'][]>([]);
  const today = localTodayKey();
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, WorkItem[]>();
    for (const item of items) {
      if (item.deletedAt || !item.dueDate) continue;
      if (selectedCategoryIds.length > 0 && !selectedCategoryIds.includes(item.categoryId)) continue;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) continue;
      const current = grouped.get(item.dueDate) ?? [];
      current.push(item);
      grouped.set(item.dueDate, sortByDueDate(current));
    }
    return grouped;
  }, [items, selectedCategoryIds, selectedStatuses]);
  const days = useMemo(() => buildCalendarGrid(month), [month]);
  const holidays = useMemo(() => new Map([month.getFullYear() - 1, month.getFullYear(), month.getFullYear() + 1].flatMap((year) => [...holidaysForYear(year).entries()])), [month]);
  const toggleCategory = (categoryId: string | null) => setSelectedCategoryIds((current) => current.includes(categoryId) ? current.filter((entry) => entry !== categoryId) : [...current, categoryId]);
  const toggleStatus = (status: WorkItem['status']) => setSelectedStatuses((current) => current.includes(status) ? current.filter((entry) => entry !== status) : [...current, status]);
  return <section className="work-calendar" aria-label="工作日历">
    <header className="work-calendar__header"><div><p className="work-calendar__eyebrow">只读视图</p><h1>{monthTitle(month)}</h1></div><div className="work-calendar__actions"><button type="button" aria-label="上月" onClick={() => setMonth((current) => shiftMonth(current, -1))}>上月</button><button type="button" onClick={() => setMonth(new Date())}>回到今天</button><button type="button" aria-label="下月" onClick={() => setMonth((current) => shiftMonth(current, 1))}>下月</button><button type="button" className="work-calendar__close" onClick={onClose}>关闭日历</button></div></header>
    <fieldset className="work-calendar__categories"><legend>状态</legend><button type="button" className={selectedStatuses.length === 0 ? 'work-calendar__category-all is-selected' : 'work-calendar__category-all'} aria-label="全部状态" aria-pressed={selectedStatuses.length === 0} onClick={() => setSelectedStatuses([])}>全部</button>{([['doing', '进行中'], ['done', '已完成'], ['paused', '已暂停']] as const).map(([status, label]) => <label key={status}><input type="checkbox" checked={selectedStatuses.includes(status)} onChange={() => toggleStatus(status)} />{label}</label>)}</fieldset>
    <fieldset className="work-calendar__categories"><legend>分类</legend><button type="button" className={selectedCategoryIds.length === 0 ? 'work-calendar__category-all is-selected' : 'work-calendar__category-all'} aria-pressed={selectedCategoryIds.length === 0} onClick={() => setSelectedCategoryIds([])}>全部</button>{categories.map((category) => <label key={category.id}><input type="checkbox" checked={selectedCategoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />{category.name}</label>)}<label><input type="checkbox" checked={selectedCategoryIds.includes(null)} onChange={() => toggleCategory(null)} />未分类</label></fieldset>
    <div className="work-calendar__weekdays" aria-hidden="true">{WEEKDAY_LABELS.map((label) => <span className="work-calendar__weekday" key={label}>周{label}</span>)}</div>
    <div className="work-calendar__grid" role="grid" aria-label={`${monthTitle(month)}月历`}>{days.map((day) => {
      const dayItems = itemsByDate.get(day.key) ?? [];
      const holiday = holidays.get(day.key);
      const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
      return <div className={`work-calendar__day${day.inCurrentMonth ? '' : ' work-calendar__day--outside'}${day.key === today ? ' work-calendar__day--today' : ''}${holiday || weekend ? ' work-calendar__day--red-date' : ''}`} data-date={day.key} role="gridcell" key={day.key}>
        <div className="work-calendar__date-row"><button className="work-calendar__number" type="button" aria-label={`${day.key}${dayItems.length ? `，${dayItems.length}条事项` : ''}`} tabIndex={0}>{day.day}</button>{holiday && <span className="work-calendar__festival" title={holiday}>{holiday}</span>}</div>
        {dayItems.length > 0 && <div className="work-calendar__titles">{dayItems.slice(0, 3).map((item) => <div className="work-calendar__title-row" title={item.title} key={item.id}><span className={`work-calendar__item-status work-calendar__item-status--${item.status}`} aria-hidden="true" />{item.isStarred && item.status !== 'done' && <span className="work-calendar__star" aria-label="已星标">★</span>}<span className="work-calendar__title">{item.title}</span></div>)}{dayItems.length > 3 && <div className="work-calendar__more">另有 {dayItems.length - 3} 项</div>}</div>}
        <div className="work-calendar__popover" role="tooltip"><p className="work-calendar__popover-title">{dayItems.length > 0 ? '当日事项' : '当日暂无事项'}</p>{dayItems.length > 0 && <ul>{dayItems.map((item) => <li key={item.id}><button className="work-calendar__item-button" type="button" onClick={() => onOpenItem?.(item.id)}><span className={`work-calendar__item-status work-calendar__item-status--${item.status}`} aria-hidden="true" />{item.isStarred && item.status !== 'done' && <span className="work-calendar__star" aria-label="已星标">★</span>}<span>{item.title}</span></button></li>)}</ul>}<button className="work-calendar__new-item" type="button" onClick={() => onNewItem?.(day.key)}>新增计划</button></div>
      </div>;
    })}</div>
  </section>;
}
