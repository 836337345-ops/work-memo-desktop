import { useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
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
  onBeforeCategoryChange: () => Promise<boolean>;
  onCategoriesChanged: (categories: Category[]) => Promise<void>;
  onOpenBackup: () => void;
  onOpenExport: () => void;
  onOpenWorkbenchNameSettings: () => void;
  autostartEnabled: boolean;
  autostartReady: boolean;
  autostartBusy: boolean;
  autostartError: string;
  onToggleAutostart: () => void;
}

type Group = 'status' | 'time' | 'category';
type ExpandedState = Record<Group, boolean>;
const STORAGE_KEY = 'work-memo.sidebar-expanded.v2.1';
const defaultExpanded: ExpandedState = { status: true, time: false, category: false };

const statusLinks: Array<{ value: ItemStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部进度' }, ...Object.entries(STATUS_LABELS).filter(([value]) => value !== 'todo').map(([value, label]) => ({ value: value as ItemStatus, label })),
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

export function Sidebar({ categories, workbenchName, filters, trash, calendar, onDateFilter, onCategory, onStatus, onTrash, onShowAll, onShowDoing, onOpenCalendar, onBeforeCategoryChange, onCategoriesChanged, onOpenBackup, onOpenExport, onOpenWorkbenchNameSettings, autostartEnabled, autostartReady, autostartBusy, autostartError, onToggleAutostart }: SidebarProps) {
  const [expanded, setExpanded] = useState<ExpandedState>(readExpanded);
  const [newCategory, setNewCategory] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [name, setName] = useState(''); const [categoryError, setCategoryError] = useState('');
  const toggle = (group: Group) => setExpanded((current) => { const next = { ...current, [group]: !current[group] }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 本机存储不可用时不影响导航 */ } return next; });
  const categoryLabel = filters.categoryId === undefined ? '全部分类' : filters.categoryId === null ? '未分类' : categories.find((category) => category.id === filters.categoryId)?.name ?? '未分类';
  const summary = { status: filters.status === 'all' ? '全部进度' : STATUS_LABELS[filters.status], time: dateLinks.find((link) => link.value === filters.date)?.label ?? '全部时间', category: categoryLabel };
  const updateCategories = async (action: () => Promise<Category[]>) => { try { setCategoryError(''); if (await onBeforeCategoryChange()) await onCategoriesChanged(await action()); } catch (reason) { setCategoryError(String(reason)); } };
  const addCategory = () => { if (newCategory.trim()) void updateCategories(async () => { const result = await api.createCategory(newCategory.trim()); setNewCategory(''); return result; }); };
  const move = (index: number, direction: -1 | 1) => { const next = [...categories]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; void updateCategories(() => api.reorderCategories(next.map((category) => category.id))); };
  const removeCategory = async (category: Category) => { if (await confirm(`删除“${category.name}”后，其关联事项将转为“未分类”。此操作不能自动撤销，是否继续？`, { title: '删除分类', kind: 'warning', okLabel: '删除分类', cancelLabel: '取消' })) void updateCategories(() => api.deleteCategory(category.id)); };
  return <aside className="sidebar" aria-label="事项导航">
    <div className="brand"><span className="sidebar-workbench-name" title={workbenchName}>{workbenchName}</span><button type="button" className="sidebar-workbench-settings" onClick={onOpenWorkbenchNameSettings}>修改</button></div>
    <button className={calendar ? 'sidebar-calendar active' : 'sidebar-calendar'} onClick={onOpenCalendar}>工作日历</button>
    <button className="sidebar-show-all" onClick={onShowAll}>工作列表</button>
    <nav>
      <section className={`sidebar-group sidebar-group-${expanded.status ? 'open' : 'closed'}`}>
        <button className="sidebar-group-title" aria-expanded={expanded.status} aria-controls="status-filter-group" onClick={() => toggle('status')}><CollapseIcon expanded={expanded.status} /><span className="sidebar-group-label">进度{!expanded.status && <small> · {summary.status}</small>}</span></button>
        {expanded.status && <div id="status-filter-group" className="sidebar-group-options">{statusLinks.map((link) => <button key={link.value} className={!trash && filters.status === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onStatus(link.value)}>{link.label}</button>)}</div>}
      </section>
      <section className={`sidebar-group sidebar-group-${expanded.time ? 'open' : 'closed'}`}>
        <button className="sidebar-group-title" aria-expanded={expanded.time} aria-controls="date-filter-group" onClick={() => toggle('time')}><CollapseIcon expanded={expanded.time} /><span className="sidebar-group-label">时间{!expanded.time && <small> · {summary.time}</small>}</span></button>
        {expanded.time && <div id="date-filter-group" className="sidebar-group-options">{dateLinks.map((link) => <button key={link.value} className={!trash && filters.date === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onDateFilter(link.value)}>{link.label}</button>)}</div>}
      </section>
      <section className={`sidebar-group sidebar-group-${expanded.category ? 'open' : 'closed'}`}>
        <div className="sidebar-group-title-wrap"><button className="sidebar-group-title" aria-expanded={expanded.category} aria-controls="category-filter-group" onClick={() => toggle('category')}><CollapseIcon expanded={expanded.category} /><span className="sidebar-group-label">分类{!expanded.category && <small> · {summary.category}</small>}</span></button><button className="icon-button" onClick={() => setExpanded((current) => ({ ...current, category: true }))} title="新增分类" aria-label="新增分类">＋</button></div>
        {expanded.category && <div id="category-filter-group" className="sidebar-group-options"><div className="add-category"><input aria-label="新分类名称" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addCategory()} placeholder="新增分类" /><button type="button" onClick={addCategory}>添加</button></div><button className={!trash && filters.categoryId === undefined ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(undefined)}>全部分类</button><button className={!trash && filters.categoryId === null ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(null)}>未分类</button>{categories.map((category, index) => <div className="sidebar-category-row" key={category.id}>{editing === category.id ? <input aria-label="分类名称" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) { void updateCategories(() => api.renameCategory(category.id, name.trim())); setEditing(null); } }} /> : <button className={!trash && filters.categoryId === category.id ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(category.id)}>{category.name}</button>}<span className="category-actions"><button type="button" disabled={index === 0} aria-label={`上移 ${category.name}`} onClick={() => move(index, -1)}>↑</button><button type="button" disabled={index === categories.length - 1} aria-label={`下移 ${category.name}`} onClick={() => move(index, 1)}>↓</button>{editing === category.id ? <button type="button" onClick={() => { if (name.trim()) { void updateCategories(() => api.renameCategory(category.id, name.trim())); setEditing(null); } }}>保存</button> : <button type="button" onClick={() => { setEditing(category.id); setName(category.name); }}>改名</button>}<button type="button" className="danger-text" onClick={() => void removeCategory(category)}>删除</button></span></div>)}{categoryError && <p className="form-error" role="alert">{categoryError}</p>}</div>}
      </section>
    </nav>
    <div className="sidebar-bottom"><button className={trash ? 'nav-link active' : 'nav-link'} onClick={onTrash}>回收站</button><button className="nav-link" onClick={onOpenBackup}>备份与恢复</button><button className="nav-link" onClick={onOpenExport}>导出事项</button><div className="autostart-control"><span id="autostart-label">开机自启动</span><button type="button" className="autostart-switch" role="switch" aria-labelledby="autostart-label" aria-checked={autostartEnabled} aria-busy={autostartBusy || !autostartReady} disabled={autostartBusy || !autostartReady} onClick={onToggleAutostart}><span aria-hidden="true" /></button>{!autostartReady && !autostartError && <small>正在读取设置…</small>}{autostartError && <p role="alert">{autostartError}</p>}</div></div>
  </aside>;
}
