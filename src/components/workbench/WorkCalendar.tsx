import { useMemo, useState } from 'react';
import { STATUS_LABELS, type ItemStatus, type WorkItem } from '../../types';
import { buildCalendarGrid, dateKey, monthTitle, shiftMonth, WEEKDAY_LABELS } from './calendar';
import './calendar.css';

interface WorkCalendarProps { items: WorkItem[]; onClose: () => void; }
const statusOrder: ItemStatus[] = ['todo', 'doing', 'done', 'paused'];

function localTodayKey(): string { return dateKey(new Date()); }

export function WorkCalendar({ items, onClose }: WorkCalendarProps) {
  const [month, setMonth] = useState(() => new Date());
  const today = localTodayKey();
  const itemsByDate = useMemo(() => {
    const grouped = new Map<string, WorkItem[]>();
    for (const item of items) {
      if (item.deletedAt || !item.dueDate) continue;
      const current = grouped.get(item.dueDate) ?? [];
      current.push(item);
      grouped.set(item.dueDate, current);
    }
    return grouped;
  }, [items]);
  const days = useMemo(() => buildCalendarGrid(month), [month]);
  return <section className="work-calendar" aria-label="工作日历">
    <header className="work-calendar__header"><div><p className="work-calendar__eyebrow">只读视图</p><h1>{monthTitle(month)}</h1></div><div className="work-calendar__actions"><button type="button" aria-label="上月" onClick={() => setMonth((current) => shiftMonth(current, -1))}>上月</button><button type="button" onClick={() => setMonth(new Date())}>回到今天</button><button type="button" aria-label="下月" onClick={() => setMonth((current) => shiftMonth(current, 1))}>下月</button><button type="button" className="work-calendar__close" onClick={onClose}>关闭日历</button></div></header>
    <div className="work-calendar__weekdays" aria-hidden="true">{WEEKDAY_LABELS.map((label) => <span className="work-calendar__weekday" key={label}>周{label}</span>)}</div>
    <div className="work-calendar__grid" role="grid" aria-label={`${monthTitle(month)}月历`}>{days.map((day) => {
      const dayItems = itemsByDate.get(day.key) ?? [];
      const counts = statusOrder.map((status) => ({ status, count: dayItems.filter((item) => item.status === status).length })).filter((entry) => entry.count > 0);
      return <div className={`work-calendar__day${day.inCurrentMonth ? '' : ' work-calendar__day--outside'}${day.key === today ? ' work-calendar__day--today' : ''}`} role="gridcell" key={day.key}>
        <button className="work-calendar__number" type="button" aria-label={`${day.key}${dayItems.length ? `，${dayItems.length}条事项` : ''}`} tabIndex={dayItems.length ? 0 : -1}>{day.day}</button>
        {counts.length > 0 && <div className="work-calendar__markers" aria-label={`共${dayItems.length}条事项`}>{counts.map(({ status, count }) => <span className={`work-calendar__status work-calendar__status--${status}`} key={status} title={STATUS_LABELS[status]} aria-label={`${STATUS_LABELS[status]} ${count}条`}>{count}</span>)}</div>}
        {dayItems.length > 0 && <div className="work-calendar__popover" role="tooltip"><p className="work-calendar__popover-title">当日事项</p><ul>{dayItems.map((item) => <li key={item.id}>{item.title}</li>)}</ul></div>}
      </div>;
    })}</div>
  </section>;
}
