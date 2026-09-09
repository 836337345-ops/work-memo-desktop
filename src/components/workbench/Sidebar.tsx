import { useState } from 'react';
import { STATUS_LABELS, type Category, type ItemStatus } from '../../types';
import type { DateFilter } from '../../lib/filters';
import './sidebar.css';

export interface FilterState {
  status: ItemStatus | 'all';
  date: DateFilter;
  categoryId: string | null | undefined;
}

interface SidebarProps {
  categories: Category[];
  workbenchName: string;
  filters: FilterState;
  trash: boolean;
  calendar: boolean;
  onDateFilter: (value: DateFilter) => void;
  onCategory: (categoryId: string | null | undefined) => void;
  onStatus: (status: ItemStatus | 'all') => void;
  onTrash: () => void;
  onShowAll: () => void;
  onShowDoing: () => void;
  onOpenCalendar: () => void;
  onManageCategories: () => void;
  onOpenBackup: () => void;
  onOpenExport: () => void;
  onOpenWorkbenchNameSettings: () => void;
}

type Group = 'status' | 'time' | 'category';
type ExpandedState = Record<Group, boolean>;
const STORAGE_KEY = 'work-memo.sidebar-expanded.v2.1';
const defaultExpanded: ExpandedState = { status: true, time: false, category: false };

const statusLinks: Array<{ value: ItemStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部状态' }, ...Object.entries(STATUS_LABELS).filter(([value]) => value !== 'todo').map(([value, label]) => ({ value: value as ItemStatus, label })),
];
const dateLinks: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: '全部时间' }, { value: 'today', label: '今天' }, { value: 'thisWeek', label: '本周' },
  { value: 'nextWeek', label: '下周' }, { value: 'thisMonth', label: '本月' }, { value: 'nextMonth', label: '下月' }, { value: 'history', label: '历史' },
];

function CollapseIcon({ expanded }: { expanded: boolean }) {
  return <svg className="collapse-icon" viewBox="0 0 18 18" data-direction={expanded ? 'up' : 'down'} aria-hidden="true"><path d="M4 3.5h10M4 7.5h10" /><path d={expanded ? 'm5 15 4-4 4 4' : 'm5 11 4 4 4-4'} /></svg>;
}

function readExpanded(): ExpandedState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ExpandedState> | null;
    return { ...defaultExpanded, ...(saved ?? {}) };
  } catch { return defaultExpanded; }
}

export function Sidebar({ categories, workbenchName, filters, trash, calendar, onDateFilter, onCategory, onStatus, onTrash, onShowAll, onShowDoing, onOpenCalendar, onManageCategories, onOpenBackup, onOpenExport, onOpenWorkbenchNameSettings }: SidebarProps) {
  const [expanded, setExpanded] = useState<ExpandedState>(readExpanded);
  const toggle = (group: Group) => setExpanded((current) => { const next = { ...current, [group]: !current[group] }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 本机存储不可用时不影响导航 */ } return next; });
  const categoryLabel = filters.categoryId === undefined ? '全部分类' : filters.categoryId === null ? '未分类' : categories.find((category) => category.id === filters.categoryId)?.name ?? '未分类';
  const summary = { status: filters.status === 'all' ? '全部状态' : STATUS_LABELS[filters.status], time: dateLinks.find((link) => link.value === filters.date)?.label ?? '全部时间', category: categoryLabel };
  return <aside className="sidebar" aria-label="事项导航">
    <div className="brand"><span className="sidebar-workbench-name" title={workbenchName}>{workbenchName}</span><button type="button" className="sidebar-workbench-settings" onClick={onOpenWorkbenchNameSettings}>修改</button></div>
    <button className={calendar ? 'sidebar-calendar active' : 'sidebar-calendar'} onClick={onOpenCalendar}>工作日历</button>
    <button className="sidebar-show-doing" onClick={onShowDoing}>进行中</button>
    <button className="sidebar-show-all" onClick={onShowAll}>全部</button>
    <nav>
      <section className={`sidebar-group sidebar-group-${expanded.status ? 'open' : 'closed'}`}>
        <button className="sidebar-group-title" aria-expanded={expanded.status} aria-controls="status-filter-group" onClick={() => toggle('status')}><CollapseIcon expanded={expanded.status} /><span className="sidebar-group-label">状态{!expanded.status && <small> · {summary.status}</small>}</span></button>
        {expanded.status && <div id="status-filter-group" className="sidebar-group-options">{statusLinks.map((link) => <button key={link.value} className={!trash && filters.status === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onStatus(link.value)}>{link.label}</button>)}</div>}
      </section>
      <section className={`sidebar-group sidebar-group-${expanded.time ? 'open' : 'closed'}`}>
        <button className="sidebar-group-title" aria-expanded={expanded.time} aria-controls="date-filter-group" onClick={() => toggle('time')}><CollapseIcon expanded={expanded.time} /><span className="sidebar-group-label">时间{!expanded.time && <small> · {summary.time}</small>}</span></button>
        {expanded.time && <div id="date-filter-group" className="sidebar-group-options">{dateLinks.map((link) => <button key={link.value} className={!trash && filters.date === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onDateFilter(link.value)}>{link.label}</button>)}</div>}
      </section>
      <section className={`sidebar-group sidebar-group-${expanded.category ? 'open' : 'closed'}`}>
        <div className="sidebar-group-title-wrap"><button className="sidebar-group-title" aria-expanded={expanded.category} aria-controls="category-filter-group" onClick={() => toggle('category')}><CollapseIcon expanded={expanded.category} /><span className="sidebar-group-label">分类{!expanded.category && <small> · {summary.category}</small>}</span></button><button className="icon-button" onClick={onManageCategories} title="管理分类" aria-label="管理分类">⚙</button></div>
        {expanded.category && <div id="category-filter-group" className="sidebar-group-options"><button className={!trash && filters.categoryId === undefined ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(undefined)}>全部分类</button><button className={!trash && filters.categoryId === null ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(null)}>未分类</button>{categories.map((category) => <button key={category.id} className={!trash && filters.categoryId === category.id ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(category.id)}>{category.name}</button>)}</div>}
      </section>
    </nav>
    <div className="sidebar-bottom"><button className={trash ? 'nav-link active' : 'nav-link'} onClick={onTrash}>回收站</button><button className="nav-link" onClick={onOpenBackup}>备份与恢复</button><button className="nav-link" onClick={onOpenExport}>导出事项</button></div>
  </aside>;
}
