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
  filters: FilterState;
  trash: boolean;
  onDateFilter: (value: DateFilter) => void;
  onCategory: (categoryId: string | null | undefined) => void;
  onStatus: (status: ItemStatus | 'all') => void;
  onTrash: () => void;
  onManageCategories: () => void;
  onOpenBackup: () => void;
  onOpenExport: () => void;
}

type Group = 'status' | 'time' | 'category';
type ExpandedState = Record<Group, boolean>;
const STORAGE_KEY = 'work-memo.sidebar-expanded.v2.1';
const defaultExpanded: ExpandedState = { status: true, time: false, category: false };

const statusLinks: Array<{ value: ItemStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部状态' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: value as ItemStatus, label })),
];
const dateLinks: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: '全部时间' }, { value: 'today', label: '今天' }, { value: 'thisWeek', label: '本周' },
  { value: 'nextWeek', label: '下周' }, { value: 'thisMonth', label: '本月' }, { value: 'nextMonth', label: '下月' }, { value: 'history', label: '历史' },
];

function readExpanded(): ExpandedState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<ExpandedState> | null;
    return { ...defaultExpanded, ...(saved ?? {}) };
  } catch { return defaultExpanded; }
}

export function Sidebar({ categories, filters, trash, onDateFilter, onCategory, onStatus, onTrash, onManageCategories, onOpenBackup, onOpenExport }: SidebarProps) {
  const [expanded, setExpanded] = useState<ExpandedState>(readExpanded);
  const toggle = (group: Group) => setExpanded((current) => { const next = { ...current, [group]: !current[group] }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 本机存储不可用时不影响导航 */ } return next; });
  const categoryLabel = filters.categoryId === undefined ? '全部分类' : filters.categoryId === null ? '未分类' : categories.find((category) => category.id === filters.categoryId)?.name ?? '未分类';
  const summary = { status: filters.status === 'all' ? '全部' : STATUS_LABELS[filters.status], time: dateLinks.find((link) => link.value === filters.date)?.label ?? '全部时间', category: categoryLabel };
  return <aside className="sidebar" aria-label="事项导航">
    <div className="brand"><span className="brand-mark">✓</span><span>工作备忘录</span></div>
    <nav>
      <section className={`sidebar-group sidebar-group-${expanded.status ? 'open' : 'closed'}`}>
        <button className="sidebar-group-title" aria-expanded={expanded.status} aria-controls="status-filter-group" onClick={() => toggle('status')}><span>状态</span>{!expanded.status && <small>{summary.status}</small>}<span className="group-chevron" aria-hidden="true">{expanded.status ? '⌃' : '⌄'}</span></button>
        {expanded.status && <div id="status-filter-group" className="sidebar-group-options">{statusLinks.map((link) => <button key={link.value} className={!trash && filters.status === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onStatus(link.value)}>{link.label}</button>)}</div>}
      </section>
      <section className={`sidebar-group sidebar-group-${expanded.time ? 'open' : 'closed'}`}>
        <button className="sidebar-group-title" aria-expanded={expanded.time} aria-controls="date-filter-group" onClick={() => toggle('time')}><span>时间</span>{!expanded.time && <small>{summary.time}</small>}<span className="group-chevron" aria-hidden="true">{expanded.time ? '⌃' : '⌄'}</span></button>
        {expanded.time && <div id="date-filter-group" className="sidebar-group-options">{dateLinks.map((link) => <button key={link.value} className={!trash && filters.date === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onDateFilter(link.value)}>{link.label}</button>)}</div>}
      </section>
      <section className={`sidebar-group sidebar-group-${expanded.category ? 'open' : 'closed'}`}>
        <div className="sidebar-group-title-wrap"><button className="sidebar-group-title" aria-expanded={expanded.category} aria-controls="category-filter-group" onClick={() => toggle('category')}><span>分类</span>{!expanded.category && <small>{summary.category}</small>}<span className="group-chevron" aria-hidden="true">{expanded.category ? '⌃' : '⌄'}</span></button><button className="icon-button" onClick={onManageCategories} title="管理分类" aria-label="管理分类">⚙</button></div>
        {expanded.category && <div id="category-filter-group" className="sidebar-group-options"><button className={!trash && filters.categoryId === undefined ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(undefined)}>全部分类</button><button className={!trash && filters.categoryId === null ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(null)}>未分类</button>{categories.map((category) => <button key={category.id} className={!trash && filters.categoryId === category.id ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(category.id)}>{category.name}</button>)}</div>}
      </section>
    </nav>
    <div className="sidebar-bottom"><button className={trash ? 'nav-link active' : 'nav-link'} onClick={onTrash}>回收站</button><button className="nav-link" onClick={onOpenBackup}>备份与恢复</button><button className="nav-link" onClick={onOpenExport}>导出事项</button></div>
  </aside>;
}
