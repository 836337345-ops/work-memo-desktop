import { useRef, useState } from 'react';
import { confirm } from '@tauri-apps/plugin-dialog';
import { api } from '../../api';
import categoryDragHandle from '../../assets/category-drag-handle.png';
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
  const [showNewCategory, setShowNewCategory] = useState(false); const [newCategory, setNewCategory] = useState(''); const [editing, setEditing] = useState<string | null>(null); const [name, setName] = useState(''); const [categoryError, setCategoryError] = useState(''); const [newCategoryError, setNewCategoryError] = useState(''); const draggingRef = useRef<string | null>(null); const [dragOver, setDragOver] = useState<{ id: string; after: boolean } | null>(null); const dragOverRef = useRef<typeof dragOver>(null);
  const toggle = (group: Group) => setExpanded((current) => { const next = { ...current, [group]: !current[group] }; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* 本机存储不可用时不影响导航 */ } return next; });
  const categoryLabel = filters.categoryId === undefined ? '全部分类' : filters.categoryId === null ? '未分类' : categories.find((category) => category.id === filters.categoryId)?.name ?? '未分类';
  const summary = { status: filters.status === 'all' ? '全部进度' : STATUS_LABELS[filters.status], time: dateLinks.find((link) => link.value === filters.date)?.label ?? '全部时间', category: categoryLabel };
  const updateCategories = async (action: () => Promise<Category[]>) => { try { setCategoryError(''); if (await onBeforeCategoryChange()) await onCategoriesChanged(await action()); } catch (reason) { setCategoryError(String(reason)); } };
  const addCategory = async () => { const name = newCategory.trim(); if (!name) { setNewCategoryError('请输入分类名称。'); return; } try { setNewCategoryError(''); if (!await onBeforeCategoryChange()) return; await onCategoriesChanged(await api.createCategory(name)); setNewCategory(''); setShowNewCategory(false); } catch (reason) { setNewCategoryError(String(reason)); } };
  const setDropTarget = (next: typeof dragOver) => { dragOverRef.current = next; setDragOver(next); };
  const dropCategory = (target: typeof dragOver = dragOverRef.current) => { const sourceId = draggingRef.current; draggingRef.current = null; setDropTarget(null); if (!sourceId || !target || sourceId === target.id) return; const next = [...categories]; const source = next.findIndex((category) => category.id === sourceId); const targetIndex = next.findIndex((category) => category.id === target.id); if (source < 0 || targetIndex < 0) return; const [moved] = next.splice(source, 1); next.splice(targetIndex - (source < targetIndex ? 1 : 0) + Number(target.after), 0, moved); void updateCategories(() => api.reorderCategories(next.map((category) => category.id))); };
  const updateDragTarget = (sourceId: string, clientX: number, clientY: number) => { const row = document.elementFromPoint?.(clientX, clientY)?.closest<HTMLElement>('.sidebar-category-row'); const targetId = row?.dataset.categoryId; if (!targetId || targetId === sourceId) return setDropTarget(null); const source = categories.findIndex((category) => category.id === sourceId); const target = categories.findIndex((category) => category.id === targetId); const rect = row.getBoundingClientRect(); setDropTarget({ id: targetId, after: rect.height ? clientY > rect.top + rect.height / 2 : source < target }); };
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
        <div className="sidebar-group-title-wrap"><button className="sidebar-group-title" aria-expanded={expanded.category} aria-controls="category-filter-group" onClick={() => toggle('category')}><CollapseIcon expanded={expanded.category} /><span className="sidebar-group-label">分类{!expanded.category && <small> · {summary.category}</small>}</span></button><button className="icon-button" onClick={() => { setNewCategory(''); setNewCategoryError(''); setShowNewCategory(true); }} title="新增分类" aria-label="新增分类">＋</button></div>
        {expanded.category && <div id="category-filter-group" className="sidebar-group-options"><button className={!trash && filters.categoryId === undefined ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(undefined)}>全部分类</button><button className={!trash && filters.categoryId === null ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(null)}>未分类</button>{categories.map((category) => <div className={`sidebar-category-row${dragOver?.id === category.id ? dragOver.after ? ' is-drag-after' : ' is-drag-before' : ''}`} data-category-id={category.id} key={category.id}><button className="category-drag-handle" type="button" aria-label={`拖拽排序 ${category.name}`} onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture?.(event.pointerId); draggingRef.current = category.id; setDropTarget(null); }} onPointerMove={(event) => { if (draggingRef.current === category.id) updateDragTarget(category.id, event.clientX, event.clientY); }} onPointerUp={(event) => { if (draggingRef.current !== category.id) return; event.currentTarget.releasePointerCapture?.(event.pointerId); dropCategory(); }} onPointerCancel={() => { draggingRef.current = null; setDropTarget(null); }}><img src={categoryDragHandle} alt="" /></button>{editing === category.id ? <input aria-label="分类名称" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && name.trim()) { void updateCategories(() => api.renameCategory(category.id, name.trim())); setEditing(null); } }} /> : <button className={!trash && filters.categoryId === category.id ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(category.id)}>{category.name}</button>}<span className="category-actions">{editing === category.id ? <button type="button" className="category-rename" onClick={() => { if (name.trim()) { void updateCategories(() => api.renameCategory(category.id, name.trim())); setEditing(null); } }}>保存</button> : <button type="button" className="category-rename" onClick={() => { setEditing(category.id); setName(category.name); }}>改</button>}<button type="button" className="danger-text" aria-label={`删除 ${category.name}`} onClick={() => void removeCategory(category)}>×</button></span></div>)}{categoryError && <p className="form-error" role="alert">{categoryError}</p>}</div>}
      </section>
    </nav>
    <div className="sidebar-bottom"><button className={trash ? 'nav-link active' : 'nav-link'} onClick={onTrash}>回收站</button><button className="nav-link" onClick={onOpenBackup}>备份与恢复</button><button className="nav-link" onClick={onOpenExport}>导出事项</button><div className="autostart-control"><span id="autostart-label">开机自启动</span><button type="button" className="autostart-switch" role="switch" aria-labelledby="autostart-label" aria-checked={autostartEnabled} aria-busy={autostartBusy || !autostartReady} disabled={autostartBusy || !autostartReady} onClick={onToggleAutostart}><span aria-hidden="true" /></button>{!autostartReady && !autostartError && <small>正在读取设置…</small>}{autostartError && <p role="alert">{autostartError}</p>}</div></div>
    {showNewCategory && <section className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="new-category-title"><div className="modal-card category-manager"><header><div><p className="eyebrow">分类</p><h2 id="new-category-title">新增分类</h2></div><button type="button" className="icon-button" aria-label="关闭" onClick={() => setShowNewCategory(false)}>×</button></header><label className="item-editor__field" htmlFor="new-category-input">分类名称<input id="new-category-input" autoFocus value={newCategory} onChange={(event) => { setNewCategory(event.target.value); setNewCategoryError(''); }} onKeyDown={(event) => event.key === 'Enter' && void addCategory()} /></label>{newCategoryError && <p className="form-error" role="alert">{newCategoryError}</p>}<footer><button type="button" className="secondary-button" onClick={() => setShowNewCategory(false)}>取消</button><button type="button" className="primary-button" onClick={() => void addCategory()}>添加</button></footer></div></section>}
  </aside>;
}
