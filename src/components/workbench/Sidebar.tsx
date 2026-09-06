import { STATUS_LABELS, type Category, type ItemStatus } from '../../types';
import type { DateFilter } from '../../lib/filters';

export type ActiveFilter = { dimension: 'status'; value: ItemStatus } | { dimension: 'date'; value: Exclude<DateFilter, 'all'> } | { dimension: 'category'; value: string | null } | null;

interface SidebarProps {
  categories: Category[];
  activeFilter: ActiveFilter;
  trash: boolean;
  onDateFilter: (value: DateFilter) => void;
  onCategory: (categoryId: string | null | undefined) => void;
  onStatus: (status: ItemStatus | 'all') => void;
  onTrash: () => void;
  onManageCategories: () => void;
  onOpenBackup: () => void;
  onOpenExport: () => void;
}

const dateLinks: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: '全部时间' }, { value: 'today', label: '今天' }, { value: 'thisWeek', label: '本周' },
  { value: 'nextWeek', label: '下周' }, { value: 'thisMonth', label: '本月' }, { value: 'nextMonth', label: '下月' },
  { value: 'history', label: '历史' }, { value: 'overdue', label: '已逾期' },
];

const statusLinks: Array<{ value: ItemStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部状态' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: value as ItemStatus, label })),
];

export function Sidebar({ categories, activeFilter, trash, onDateFilter, onCategory, onStatus, onTrash, onManageCategories, onOpenBackup, onOpenExport }: SidebarProps) {
  return <aside className="sidebar" aria-label="事项导航">
    <div className="brand"><span className="brand-mark">✓</span><span>工作备忘录</span></div>
    <nav>
      <p className="nav-title">状态</p>
      {statusLinks.map((link) => <button key={link.value} className={!trash && (link.value === 'all' ? activeFilter?.dimension !== 'status' : activeFilter?.dimension === 'status' && activeFilter.value === link.value) ? 'nav-link active' : 'nav-link'} onClick={() => onStatus(link.value)}>{link.label}</button>)}
      <p className="nav-title">时间</p>
      {dateLinks.map((link) => <button key={link.value} className={!trash && (link.value === 'all' ? activeFilter?.dimension !== 'date' : activeFilter?.dimension === 'date' && activeFilter.value === link.value) ? 'nav-link active' : 'nav-link'} onClick={() => onDateFilter(link.value)}>{link.label}</button>)}
      <div className="nav-heading"><p className="nav-title">分类</p><button className="icon-button" onClick={onManageCategories} title="管理分类" aria-label="管理分类">⚙</button></div>
      <button className={!trash && activeFilter?.dimension !== 'category' ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(undefined)}>全部分类</button>
      <button className={!trash && activeFilter?.dimension === 'category' && activeFilter.value === null ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(null)}>未分类</button>
      {categories.map((category) => <button key={category.id} className={!trash && activeFilter?.dimension === 'category' && activeFilter.value === category.id ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(category.id)}>{category.name}</button>)}
    </nav>
    <div className="sidebar-bottom">
      <button className={trash ? 'nav-link active' : 'nav-link'} onClick={onTrash}>回收站</button>
      <button className="nav-link" onClick={onOpenBackup}>备份与恢复</button>
      <button className="nav-link" onClick={onOpenExport}>导出事项</button>
    </div>
  </aside>;
}
