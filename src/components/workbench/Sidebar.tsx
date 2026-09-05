import { STATUS_LABELS, type Category, type ItemStatus } from '../../types';
import type { DateFilter } from '../../lib/filters';

interface SidebarProps {
  categories: Category[];
  dateFilter: DateFilter;
  categoryId: string | null | undefined;
  status: ItemStatus | 'all';
  trash: boolean;
  onDateFilter: (value: DateFilter) => void;
  onCategory: (categoryId: string | null | undefined) => void;
  onStatus: (status: ItemStatus | 'all') => void;
  onTrash: () => void;
  onManageCategories: () => void;
  onOpenBackup: () => void;
}

const dateLinks: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: '全部事项' }, { value: 'today', label: '今天' }, { value: 'thisWeek', label: '本周' },
  { value: 'nextWeek', label: '下周' }, { value: 'thisMonth', label: '本月' }, { value: 'nextMonth', label: '下月' },
  { value: 'overdue', label: '已逾期' }, { value: 'noDate', label: '未设日期' }, { value: 'custom', label: '自定义日期' },
];

const statusLinks: Array<{ value: ItemStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部状态' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value: value as ItemStatus, label })),
];

export function Sidebar({ categories, dateFilter, categoryId, status, trash, onDateFilter, onCategory, onStatus, onTrash, onManageCategories, onOpenBackup }: SidebarProps) {
  return <aside className="sidebar" aria-label="事项导航">
    <div className="brand"><span className="brand-mark">✓</span><span>工作备忘录</span></div>
    <nav>
      <p className="nav-title">时间视图</p>
      {dateLinks.map((link) => <button key={link.value} className={!trash && dateFilter === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onDateFilter(link.value)}>{link.label}</button>)}
      <p className="nav-title">状态</p>
      {statusLinks.map((link) => <button key={link.value} className={!trash && status === link.value ? 'nav-link active' : 'nav-link'} onClick={() => onStatus(link.value)}>{link.label}</button>)}
      <div className="nav-heading"><p className="nav-title">分类</p><button className="icon-button" onClick={onManageCategories} title="管理分类" aria-label="管理分类">⚙</button></div>
      <button className={!trash && categoryId === undefined ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(undefined)}>全部分类</button>
      <button className={!trash && categoryId === null ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(null)}>未分类</button>
      {categories.map((category) => <button key={category.id} className={!trash && categoryId === category.id ? 'nav-link active' : 'nav-link'} onClick={() => onCategory(category.id)}>{category.name}</button>)}
    </nav>
    <div className="sidebar-bottom">
      <button className={trash ? 'nav-link active' : 'nav-link'} onClick={onTrash}>回收站</button>
      <button className="nav-link" onClick={onOpenBackup}>备份与恢复</button>
    </div>
  </aside>;
}
